// Reverse engineer the S() and _() key/IV derivation functions
// Based on reading the obfuscated JS:
// S() builds a key based on the hash fragment (window.location.hash)
// _() builds IV based on the URL protocol (https)
// T() does: importKey(raw, S()) then decrypt(AES-CBC, iv=_(), ciphertext=fromHex(g))
// 
// Let's reconstruct S() and _():
//
// f = bytes => new Uint8Array from hex string
// m = String.fromCharCode(...)
// p = (str, n) => str.charCodeAt(n) || 0
// x = (flag) => flag ? new TextEncoder() : new TextDecoder()  (or vice versa)
// E = (g) => TextEncoder.encode(g)
// A = (g) => TextDecoder.decode(g)
//
// S() builds key bytes using the hash as input:
//   v = window.location.hash  (e.g. "#ikfbmp")
//   P = "10"
//   O = 110
//   G = 1
//   N = ""
//   B = charCodeAt("ᵟ").toString().split("")  => [7,4,8,5] (decimal codepoint)
//   for each char in B: N += String.fromCharCode(P + B[ye])  // concatenation of "10" + digit => charcode
//   N += String.fromCharCode(p(v, P/10))   // charcode at v[1] = char after #
//   N += N[1..3]
//   N += String.fromCharCode(110, 109, 117) => "nom"? let me think...
//
// Let's try to reconstruct it step by step in pure Node.js

const hash = '#ikfbmp';
const protocol = 'https:';

function p(str, n) {
  return str.charCodeAt(n) || 0;
}
function m(...args) {
  return String.fromCharCode(...args);
}

// Reconstruct S() - key derivation from hash
function S(hash) {
  const v = hash; // window.location.hash
  const P = "10";
  const O = 110;
  const G = 1;
  let N = "";
  
  const magicChar = 'ᵟ'; // unicode char
  const B = magicChar.charCodeAt(0).toString().split(""); // e.g. "7511".split("") = ["7","5","1","1"]
  console.log('Magic char codepoint:', magicChar.charCodeAt(0), '=> digits:', B);
  
  for (let ye = 0; ye < B.length; ye++) {
    N += m(parseInt(P + B[ye])); // m("10" + "7") = m(107) = 'k'
  }
  console.log('After loop N:', N, '(bytes:', [...N].map(c => c.charCodeAt(0)), ')');
  
  // N += m(p(v, P/10)) => m(p(hash, 1)) = m(charCode of hash[1])
  N += m(p(v, parseInt(P) / 10)); // P/10 = 1
  console.log('After hash char N:', N);
  
  // N += N.substring(1, 3)
  N += N.substring(1, 3);
  console.log('After N[1:3]:', N);
  
  // N += m(O, O-1, O+7) = m(110, 109, 117) = "nmu"
  N += m(O, O - 1, O + 7);
  console.log('After nmu:', N);
  
  // oe = "3579".split("") = ["3","5","7","9"]
  const oe = "3579".split("");
  
  // N += m(oe[3]+oe[2], oe[1]+oe[2]) 
  // These are string concatenations being used as numbers: "9"+"7"=97, "5"+"7"=57 (hmm, that seems like concat)
  // Actually "9"+"7" as addition = 16 (if numbers) or "97" (if strings)
  // charCodes: m(97, 57) = 'a9'
  N += m(oe[3] + oe[2], oe[1] + oe[2]); // "97" and "57" as string -> these are passed to fromCharCode, so parseInt("97") = 97, parseInt("57") = 57
  console.log('After oe[3]+oe[2]:', N, '(97=a, 57=9)');
  
  // N += m(oe[0]*G+G+oe[3], oe[0]*G+G+oe[3])
  // oe[0]*G = "3"*1 = 3, +G = +1 = 4, +oe[3] = +"9" = 4+9=13? No...
  // Actually oe[0]*G = "3"*1 = 3 (string*number = number), +G = 3+1=4, +oe[3] = 4+"9" = "49"? 
  // Let me just use JavaScript semantics
  const val1 = oe[0]*G + G + oe[3]; // "3"*1 + 1 + "9" = 3 + 1 + "9" = 4 + "9" = "49"? No: 4 + "9" = "49" as string
  console.log('val1:', val1, typeof val1);
  N += m(val1, val1);
  console.log('After val1:', N);
  
  // N += m(oe[3]*P+oe[3]*G, oe.reverse().join("").substring(0,2))
  // oe[3]*P = "9"*"10" = 90, + oe[3]*G = "9"*1 = 9, total = 99
  // oe.reverse().join("") = "9753".substring(0,2) = "97"
  const val2 = oe[3]*P + oe[3]*G; // 9*10 + 9*1 = 90+9 = 99
  const val3 = oe.reverse().join("").substring(0, 2); // "9753"[0:2] = "97"... wait oe was already mutated
  console.log('val2:', val2, 'val3:', val3);
  N += m(val2, parseInt(val3));
  console.log('Final N:', N);
  console.log('N bytes:', [...N].map(c => c.charCodeAt(0)));
  
  // Now encode N as bytes
  const enc = new TextEncoder();
  return Buffer.from(enc.encode(N));
}

// Reconstruct _() - IV derivation from protocol
function _iv(protocol) {
  const v = protocol; // "https:"
  const P = v + "//";
  const O = window_location_host; // we need the host
  // Actually this uses window.location, let's just compute for known values
  
  const G = v.length * P.length; // 6 * 8 = 48
  const N_base = 1;
  let B = "";
  for (let Ie = N_base; Ie < 10; Ie++) B += m(Ie + G); // m(1+48)=m(49)='1', m(2+48)='2', ..., m(9+48)='9' 
  
  let oe = "1" + "" + "1" + "" + "1"; // "111"
  // ye = oe.length * p(O, ...) - need host
  console.log('B:', B, '(bytes:', [...B].map(c => c.charCodeAt(0)), ')');
  
  return B;
}

// Test S() 
const keyBytes = S(hash);
console.log('\nKey bytes length:', keyBytes.length);
console.log('Key (hex):', keyBytes.toString('hex'));
