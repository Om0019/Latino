<script>
    const POW_CHALLENGE = '51d5454e58621e5ab689a77b6e07bdd7';
    const POW_DIFFICULTY = 3;
    const POW_SALT = '6d07665b9850a0db';

    (function(){
        let suspect = 0;
        if(navigator.webdriver) suspect += 3;
        if(!window.chrome && /Chrome/.test(navigator.userAgent)) suspect += 2;
        if(navigator.plugins.length === 0 && !/Mobile/.test(navigator.userAgent)) suspect += 1;
        if(navigator.languages.length === 0) suspect += 2;
        if(window.outerWidth === 0 && window.outerHeight === 0) suspect += 2;
        if(suspect >= 4) {
            document.documentElement.innerHTML = '<body style="background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">Access denied</body>';
            throw new Error('blocked');
        }
    })();

    function showDecryptionLoader() {
        const loader = document.getElementById('decryptionLoader');
        if (loader) loader.style.display = 'flex';
    }

    function hideDecryptionLoader() {
        const loader = document.getElementById('decryptionLoader');
        if (loader) loader.style.display = 'none';
    }

    function updateDecryptionProgress(current, total) {
        const progressText = document.getElementById('decryptionProgress');
        if (progressText) {
            progressText.textContent = `Descifrando enlaces... ${current}/${total}`;
        }
    }

    let dataLink = [{"file_id":57733,"video_language":"LAT","sortedEmbeds":[{"servername":"vidhide","link":"HH6QS6lHUJ2xXp2fob3rkSgsC29NOc3xfHX98\/9zDr7E94hy3lcWG8rvsJXwnRYiVX4ydMCvoc\/gIxqpQCnCqQ==","type":"video"},{"servername":"streamwish","link":"yARyZEjstgxzpXqkQn2RPFLqWy5Zth3nOQGxb9jc+rTMG2rjz1Eucm7X9rM2bsXW+Yi\/u\/1KtKrXRf+zrPTa8Q==","type":"video"},{"servername":"voe","link":"FS1tVNo0HTu7hdLBFVHi30+Jvd6WxZF2Dfp8h\/FIEhnSR02JHAjeaKkXMJpBgFRO","type":"video"}],"downloadEmbeds":[{"servername":"voe","link":"3Da5pTw1lpAmmptuiX\/shAp78H2h1jR1YcQ3bP8IslL5qgyJ29iz2HxQOemArXiDx\/qrLkfMty6kzR4z\/VN0Zg==","type":"download"},{"servername":"streamwish","link":"guyw830YDCVqnBzOiFDucIARXkrTEwqXxqdabtE8l3JlR2KGhz+8t86a4XZBiW7\/0Y10c+zk29hR+0QoMJX5mA==","type":"download"},{"servername":"vidhide","link":"eOpnXSUrde4Q6yWMV\/74W97iNkuQ3BKAvAr9FaMCgfVrf9NSvrwGDnA3k9Xbz1MRGHTGZ3LnJIW7BwlLHudsEQ==","type":"download"},{"servername":"rapidvideo","link":"s08os\/jpVw0OiQb2oTfxevSeAlTuinf9HJ5smOlAoP9t\/31mW\/vSG3xWxAVfXq9DoEyjTe5+7RhOVJiRnh0nxQ==","type":"download"}]},{"file_id":57719,"video_language":"ESP","sortedEmbeds":[{"servername":"vidhide","link":"9ho5FwBKv35ZMVMu\/ueZdg0d8WSsZ6OKHpIkFD+0NhzVU\/JlSERRtV3GUD+S3yDbFZ3sUbtj0OgVWllKg07fjQ==","type":"video"},{"servername":"streamwish","link":"z7Nle4CnpQqqPGFmgkUA8U8Bv5GttIP2XQ5kAbnHuoHKPm+M5xqwRSZsXF7nY3p0PW5Sg0MtMpCWXVNZa8SXiQ==","type":"video"},{"servername":"voe","link":"PxKSyS6p7dzAbF32pA1D6yRe1mT+s+p\/v7zotwpizulQk8mubOXTAlmluJIAwYFV","type":"video"}],"downloadEmbeds":[{"servername":"voe","link":"\/Q6Q6t2NYyv551CLFXw9jfH\/t87SzxbZ+apbmDlae3j3294Q0OHqmnfbm6+UXgQCU27C5fwQZgwxz4mSZmzNjA==","type":"download"},{"servername":"streamwish","link":"5Cyd7lB\/jSKC3ZQZwUaOjwToLBGz1pVojjTQd845zQqfGGOFANo3BmVBhaiKV8dTq4eI6Crw7VJZrS1DOe8eAQ==","type":"download"},{"servername":"vidhide","link":"nbsrSES0VrQPWC1q\/TdySaJa\/9X4s\/tq\/5xZs7jcDEBh9LKsZQzgpJh0pQoRvKV3ln\/KTGmwS9bmAAMPnqa4ug==","type":"download"},{"servername":"rapidvideo","link":"vNcQnAOaq9j+6644wCzmZ5iV40zy3I\/zkLWmf0p+TNU1ETqa78WlS7zcirseEWWnppJILWdsnt\/1F1r0S7nFEw==","type":"download"}]},{"file_id":57735,"video_language":"SUB","sortedEmbeds":[{"servername":"vidhide","link":"2TR9yA1os\/aQYzEDXrSK2KAqmpzRMHB55QtuzSxtkf5QyTxhf\/P\/YeXvm8zB2QJbmHjMKakLt7xdhSdn+8H4qg==","type":"video"},{"servername":"streamwish","link":"1UgbFvhDeUJL\/9574\/LD3FGmFQGmp2z8nA8SGD5vZXrnF3scIzTh6urCD9wC\/zsOw+sSw3J\/22fuCWO4tWAxAg==","type":"video"},{"servername":"voe","link":"HBLQOUmREI5fSWBvGc\/4of34DFPeBLFfmLNifb2szhLs4rmU6I\/i3Mh0\/dFyxe8K","type":"video"}],"downloadEmbeds":[{"servername":"voe","link":"jU46lKxLi2whJeEJ9WK4Cw3cINZrE0y1XEAEcCYTcBs\/q5x3t2d4B2CakJnpyKuwVDgN55+Nxf7wPWkatkDd5A==","type":"download"},{"servername":"streamwish","link":"6nyKs1EOFkp0HIWGm06mCrfbSzDhfjFvdM1DF43Tdcez04Hlp5wPdDfyZk\/Nqwdj8TxvukTGyq1CBvq\/q2IFSg==","type":"download"},{"servername":"vidhide","link":"VN+rG6u+IAGgdW1rilUqZWaG\/hBY7DqWR55BNGk7TWEmu\/LLrsFPGyQrjQIGjSXbtpleDbCb0Q8lqc3Dzc6ajg==","type":"download"},{"servername":"rapidvideo","link":"xCSz9d+vN9bMCrCZ3MiAhtDi7b6GmUl7Dt4b+3vgaWjIEIx4JPGpI5XCt1qnYJHLpEx+W9hKwZM1qU60tu8MEA==","type":"download"}]}];
    let currentLanguageServers = [];
    let currentLangIndex = 0;
    let powSolved = false;
    let aesKeyBytes = null;

    const powWorkerCode = `
        self.onmessage = async function(ev) {
            const { challenge, difficulty, salt } = ev.data;
            const prefix = '0'.repeat(difficulty);
            let nonce = 0;
            
            async function sha256(str) {
                const buf = new TextEncoder().encode(str);
                const hash = await crypto.subtle.digest('SHA-256', buf);
                return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
            }
            
            const batchSize = 5000;
            while(true) {
                for(let i = 0; i < batchSize; i++) {
                    const hash = await sha256(challenge + nonce);
                    if(hash.startsWith(prefix)) {
                        const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(challenge + nonce + salt));
                        self.postMessage({ done: true, nonce: nonce, aesKey: new Uint8Array(keyHash) });
                        return;
                    }
                    nonce++;
                }
                self.postMessage({ progress: true, nonce: nonce });
            }
        };
    `;

    async function decryptAES(encryptedBase64, aesKey) {
        try {
            const raw = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
            const iv = raw.slice(0, 16);
            const ciphertext = raw.slice(16);
            const key = await crypto.subtle.importKey('raw', aesKey.slice(0, 32), { name: 'AES-CBC' }, false, ['decrypt']);
            const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv }, key, ciphertext);
            return new TextDecoder().decode(decrypted);
        } catch(e) {
            return null;
        }
    }

    async function solvePoWAndDecrypt() {
        showDecryptionLoader();
        updateDecryptionProgress(0, 1);

        return new Promise((resolve) => {
            const wBlob = new Blob([powWorkerCode], { type: 'application/javascript' });
            const wUrl = URL.createObjectURL(wBlob);
            const worker = new Worker(wUrl);
            URL.revokeObjectURL(wUrl);

            worker.onmessage = async function(ev) {
                const d = ev.data;
                if(d.progress) {
                } else if(d.done) {
                    worker.terminate();
                    aesKeyBytes = d.aesKey;
                    powSolved = true;

                    await decryptAllLinksLocal();
                    hideDecryptionLoader();

                    if (pendingFirstLoad) {
                        pendingFirstLoad = false;
                        showTabContent(0);
                        if (currentLanguageServers.length > 0) {
                            const firstServer = getServerInfo(currentLanguageServers[0]);
                            showServerToast(firstServer.name);
                        }
                    }

                    resolve();
                }
            };

            worker.postMessage({
                challenge: POW_CHALLENGE,
                difficulty: POW_DIFFICULTY,
                salt: POW_SALT
            });
        });
    }

    async function decryptAllLinksLocal() {
        if (!Array.isArray(dataLink) || dataLink.length === 0) return;

        let total = 0;
        dataLink.forEach(file => {
            if(file.sortedEmbeds) total += file.sortedEmbeds.length;
            if(file.downloadEmbeds) total += file.downloadEmbeds.length;
        });

        let done = 0;
        updateDecryptionProgress(0, total);

        for(let fi = 0; fi < dataLink.length; fi++) {
            const file = dataLink[fi];
            if(file.sortedEmbeds) {
                for(let ei = 0; ei < file.sortedEmbeds.length; ei++) {
                    const embed = file.sortedEmbeds[ei];
                    if(embed.link && typeof embed.link === 'string') {
                        const decrypted = await decryptAES(embed.link, aesKeyBytes);
                        if(decrypted) dataLink[fi].sortedEmbeds[ei].link = decrypted;
                    }
                    done++;
                    updateDecryptionProgress(done, total);
                }
            }
            if(file.downloadEmbeds) {
                for(let ei = 0; ei < file.downloadEmbeds.length; ei++) {
                    const embed = file.downloadEmbeds[ei];
                    if(embed.link && typeof embed.link === 'string') {
                        const decrypted = await decryptAES(embed.link, aesKeyBytes);
                        if(decrypted) dataLink[fi].downloadEmbeds[ei].link = decrypted;
                    }
                    done++;
                    updateDecryptionProgress(done, total);
                }
            }
        }
    }

    const serverNames = {
        'voe': 'Voe',
        'filemoon': 'Filemoon',
        'doodstream': 'Doodstream',
        'streamwish': 'Streamwish',
        'vidhide': 'Vidhide',
        'rapidvideo': 'Rapidvideo',
        'download': 'Download'
    };

    function getServerInfo(server) {
        let name = server.servername === 'streamingembed' ? 'vip' : server.servername;
        let serverLink = server.link;
        if (typeof serverLink === 'object' && serverLink.link) {
            serverLink = serverLink.link;
        }
        if (typeof serverLink === 'string') {
            serverLink = serverLink.replace(/`/g, '').trim();
        }
        return {
            link: serverLink,
            icono: `${name}.ico`,
            name: serverNames[name] || name.charAt(0).toUpperCase() + name.slice(1),
            fullName: serverNames[name] || name.charAt(0).toUpperCase() + name.slice(1)
        };
    }

    const langMap = {
        'lat': 'LATINO',
        'esp': 'CASTELLANO',
        'sub': 'SUBTITULADO',
        'vose': 'SUBTITULADO',
        'jap': 'JAPONES SUB',
        'kor': 'KOREA SUB'
    };

    const langMapShort = {
        'lat': 'LAT',
        'esp': 'ESP',
        'sub': 'SUB',
        'vose': 'VOSE',
        'jap': 'JAP',
        'kor': 'KOR'
    };

    let pendingFirstLoad = false;

    function showPlayerInterface() {
        document.getElementById('fakePlayer').style.display = 'none';
        document.getElementById('playerBg').style.display = 'block';
        document.getElementById('floatingSelectors').style.display = 'flex';

        buildLanguageDropdown();

        if (dataLink.length > 0 && dataLink[0].sortedEmbeds) {
            currentLangIndex = 0;
            currentLanguageServers = dataLink[0].sortedEmbeds;
            buildServerDropdown();

            if (powSolved) {
                showTabContent(0);
                const firstServer = getServerInfo(currentLanguageServers[0]);
                showServerToast(firstServer.name);
            } else {
                pendingFirstLoad = true;
            }
        }

        setTimeout(() => startTutorial(), 800);
    }

    function buildLanguageDropdown() {
        const dropdown = document.getElementById('langDropdown');
        dropdown.innerHTML = '';

        dataLink.forEach((file, index) => {
            const option = document.createElement('button');
            option.className = `dropdown-option ${index === 0 ? 'active' : ''}`;
            option.dataset.index = index;

            const flag = document.createElement('img');
            flag.src = `https://embed69.org/static/lang/${file.video_language}.png`;
            flag.alt = file.video_language;
            option.appendChild(flag);

            const text = document.createElement('span');
            text.textContent = langMap[(file.video_language || '').toLowerCase()] || file.video_language.toUpperCase();
            option.appendChild(text);

            option.onclick = () => changeLanguage(index);
            dropdown.appendChild(option);
        });
    }

    function buildServerDropdown() {
        const dropdown = document.getElementById('serverDropdown');
        dropdown.innerHTML = '';

        currentLanguageServers.forEach((server, index) => {
            const serverInfo = getServerInfo(server);
            const option = document.createElement('button');
            option.className = `dropdown-option ${index === 0 ? 'active' : ''}`;
            option.dataset.index = index;

            const icon = document.createElement('img');
            icon.src = `https://embed69.org/static/server/${serverInfo.icono}`;
            icon.alt = serverInfo.name;
            icon.className = 'server-icon';
            option.appendChild(icon);

            const text = document.createElement('span');
            text.textContent = serverInfo.fullName;
            option.appendChild(text);

            option.onclick = () => selectServer(index);
            dropdown.appendChild(option);
        });

        const file = dataLink[currentLangIndex];
        if (file && file.downloadEmbeds && file.downloadEmbeds.length > 0) {
            const dlOption = document.createElement('button');
            dlOption.className = 'dropdown-option';
            dlOption.style.borderTop = '1px solid rgba(255,255,255,0.1)';

            const dlIcon = document.createElement('i');
            dlIcon.className = 'fas fa-download';
            dlIcon.style.fontSize = '16px';
            dlIcon.style.width = '20px';
            dlIcon.style.textAlign = 'center';
            dlOption.appendChild(dlIcon);

            const dlText = document.createElement('span');
            dlText.textContent = 'Descargar';
            dlText.style.color = '#4ade80';
            dlOption.appendChild(dlText);

            dlOption.onclick = () => {
                document.getElementById('serverDropdown').classList.remove('open');
                showDownloadPanel();
            };
            dropdown.appendChild(dlOption);
        }

        if (currentLanguageServers.length > 0) {
            const first = getServerInfo(currentLanguageServers[0]);
            document.getElementById('serverBtnText').textContent = first.fullName;
        }
    }

    function changeLanguage(index) {
        currentLangIndex = index;
        const file = dataLink[index];

        document.getElementById('langBtnFlag').src = `https://embed69.org/static/lang/${file.video_language}.png`;
        document.getElementById('langBtnText').textContent = langMapShort[(file.video_language || '').toLowerCase()] || file.video_language.toUpperCase();

        document.querySelectorAll('#langDropdown .dropdown-option').forEach((opt, i) => {
            opt.classList.toggle('active', i === index);
        });

        document.getElementById('langDropdown').classList.remove('open');

        if (file.sortedEmbeds) {
            currentLanguageServers = file.sortedEmbeds;
            buildServerDropdown();
            showTabContent(0);
            const firstServer = getServerInfo(currentLanguageServers[0]);
            showServerToast(firstServer.name);
        }
    }

    function selectServer(index) {
        const serverInfo = getServerInfo(currentLanguageServers[index]);

        document.getElementById('serverBtnText').textContent = serverInfo.fullName;

        document.querySelectorAll('#serverDropdown .dropdown-option').forEach((opt, i) => {
            opt.classList.toggle('active', i === index);
        });

        document.getElementById('serverDropdown').classList.remove('open');

        document.getElementById('downloadPanel').classList.remove('active');

        showServerToast(serverInfo.name);

        showTabContent(index);
    }

    function showTabContent(index) {
        const server = currentLanguageServers[index];
        if (!server) return;

        if (!powSolved) {
            return;
        }

        const serverInfo = getServerInfo(server);
        const iframePlayer = document.getElementById('iframePlayer');
        const iframeContainer = document.getElementById('iframeContainer');

        iframeContainer.classList.add('active');
        iframePlayer.src = serverInfo.link;
        iframePlayer.style.display = 'block';

                if (typeof go_to_playerVast === 'function') {
            go_to_playerVast('https://latgw.fun/assets/vendor/afb09d8c5bcec36b628dab0bc2ae0b69.xml?v=3.0', 'https://franecki.net/assets/vendor/8bc20f788ddcb3bc07693af8275f0e7a.xml?v=3.0');
        }
            }

    let currentDownloadEmbeds = [];

    function showDownloadPanel() {
        const file = dataLink[currentLangIndex];
        if (!file || !file.downloadEmbeds || file.downloadEmbeds.length === 0) {
            alert('No hay enlaces de descarga disponibles para este idioma.');
            return;
        }

        currentDownloadEmbeds = file.downloadEmbeds;
        const grid = document.getElementById('downloadGrid');
        grid.innerHTML = '';

        currentDownloadEmbeds.forEach((dl, index) => {
            const name = dl.servername === 'streamingembed' ? 'vip' : dl.servername;
            if (name === 'rapidvideo') return;
            const displayName = serverNames[name] || name.charAt(0).toUpperCase() + name.slice(1);

            const card = document.createElement('div');
            card.className = 'download-card';
            card.innerHTML = `
                <img src="https://embed69.org/static/server/${name}.ico" alt="${displayName}">
                <div class="download-card-info">
                    <div class="download-card-name">${displayName}</div>
                    <div class="download-card-status">Disponible</div>
                </div>
                <i class="fas fa-download"></i>
            `;
            card.onclick = () => startDownloadCountdown(index, displayName);
            grid.appendChild(card);
        });

        document.getElementById('downloadPanel').classList.add('active');
        document.getElementById('iframeContainer').classList.remove('active');
    }

    function hideDownloadPanel() {
        document.getElementById('downloadPanel').classList.remove('active');
        document.getElementById('iframeContainer').classList.add('active');
    }

    function startDownloadCountdown(index, serverName) {
        const countdown = document.getElementById('downloadCountdown');
        const numEl = document.getElementById('downloadCountdownNum');
        const serverEl = document.getElementById('downloadCountdownServer');
        const circle = document.getElementById('downloadProgressCircle');
        const goBtn = document.getElementById('downloadGoBtn');
        const textEl = document.getElementById('downloadCountdownText');

        serverEl.textContent = serverName;
        textEl.textContent = 'Preparando descarga...';
        goBtn.classList.remove('visible');
        countdown.classList.add('active');

        let seconds = 5;
        numEl.textContent = seconds;

        circle.style.transition = 'none';
        circle.style.strokeDashoffset = '283';
        requestAnimationFrame(() => {
            circle.style.transition = 'stroke-dashoffset 5s linear';
            circle.style.strokeDashoffset = '0';
        });

        const interval = setInterval(() => {
            seconds--;
            numEl.textContent = seconds;
            if (seconds <= 0) {
                clearInterval(interval);
                numEl.textContent = '✓';
                textEl.textContent = 'Descarga lista';

                const dl = currentDownloadEmbeds[index];
                let link = dl.link;
                if (typeof link === 'object' && link !== null) {
                    link = link.link || link;
                }
                if (typeof link === 'string') {
                    link = link.replace(/`/g, '').trim();
                }
                goBtn.href = link || '#';
                goBtn.classList.add('visible');
            }
        }, 1000);
    }

    document.getElementById('downloadGoBtn').addEventListener('click', () => {
        setTimeout(() => {
            document.getElementById('downloadCountdown').classList.remove('active');
        }, 300);
    });

    document.getElementById('downloadPanelClose').addEventListener('click', hideDownloadPanel);

    const warnServers = {
        'vidhide': { msg: 'Este servidor tiene ventanas emergentes y anuncios.', type: 'warning' },
        'doodstream': { msg: 'Este servidor tiene ventanas emergentes y anuncios.', type: 'warning' },
        'rapidvideo': { msg: 'Este servidor NO contiene anuncios, disfruta.', type: 'success' },
        'filemoon': { msg: 'Este servidor tiene ventanas emergentes y anuncios.', type: 'warning' },
        'streamwish': { msg: 'Este servidor tiene ventanas emergentes y anuncios.', type: 'warning' },
        'voe': { msg: 'Este servidor tiene ventanas emergentes y anuncios.', type: 'warning' }
    };

    let toastTimer = null;
    let toastProgressTimer = null;

    function showServerToast(serverName) {
        const normalizedName = serverName.toLowerCase();
        if (!warnServers[normalizedName]) return;

        const serverData = warnServers[normalizedName];
        const toast = document.getElementById('serverToast');
        const content = document.getElementById('serverToastContent');
        const progress = document.getElementById('serverToastProgress');
        const icon = document.getElementById('serverToastIcon');

        if (toastTimer) clearTimeout(toastTimer);
        if (toastProgressTimer) clearInterval(toastProgressTimer);

        if (serverData.type === 'success') {
            toast.style.borderColor = 'rgba(74, 222, 128, 0.5)';
            icon.textContent = '✅';
            content.innerHTML = `<strong style="color:#4ade80">${serverName}</strong> — ${serverData.msg}`;
            progress.style.background = 'linear-gradient(90deg, #4ade80, #22c55e)';
        } else {
            toast.style.borderColor = 'rgba(251, 191, 36, 0.5)';
            icon.textContent = '⚠️';
            content.innerHTML = `<strong>${serverName}</strong> — ${serverData.msg}`;
            progress.style.background = 'linear-gradient(90deg, #fbbf24, #f59e0b)';
        }

        toast.classList.add('visible');

        const duration = 10000;
        progress.style.width = '100%';
        progress.style.transition = 'none';

        requestAnimationFrame(() => {
            progress.style.transition = `width ${duration}ms linear`;
            progress.style.width = '0%';
        });

        toastTimer = setTimeout(() => hideServerToast(), duration);
    }

    function hideServerToast() {
        const toast = document.getElementById('serverToast');
        toast.classList.remove('visible');
        if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
        if (toastProgressTimer) { clearInterval(toastProgressTimer); toastProgressTimer = null; }
    }

    document.getElementById('serverToastClose').addEventListener('click', hideServerToast);

    document.getElementById('langSelectorBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        const langDrop = document.getElementById('langDropdown');
        const serverDrop = document.getElementById('serverDropdown');
        serverDrop.classList.remove('open');
        langDrop.classList.toggle('open');
    });

    document.getElementById('serverSelectorBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        const langDrop = document.getElementById('langDropdown');
        const serverDrop = document.getElementById('serverDropdown');
        langDrop.classList.remove('open');
        serverDrop.classList.toggle('open');
    });

    document.addEventListener('click', () => {
        document.getElementById('langDropdown').classList.remove('open');
        document.getElementById('serverDropdown').classList.remove('open');
    });

    document.getElementById('langDropdown').addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('serverDropdown').addEventListener('click', (e) => e.stopPropagation());

    function executePopupCode() {
            }

    const tutorialSteps = [
        {
            target: 'langSelectorWrap',
            title: '🌐 Cambiar Idioma',
            text: 'Aquí puedes elegir el idioma del video: Latino, Castellano, Subtitulado y más.',
            arrowLeft: '30px'
        },
        {
            target: 'serverSelectorWrap',
            title: '🖥️ Cambiar Servidor',
            text: 'Si un servidor no carga, selecciona otro aquí. Hay múltiples opciones disponibles.',
            arrowLeft: '120px'
        }
    ];

    let currentTutorialStep = 0;

    function shouldShowTutorial() {
        try {
            return !localStorage.getItem('v4_tutorial_done');
        } catch(e) {
            return true;
        }
    }

    function startTutorial() {
        if (!shouldShowTutorial()) return;
        currentTutorialStep = 0;
        const overlay = document.getElementById('tutorialOverlay');
        overlay.classList.add('active');
        renderTutorialStep();
    }

    function renderTutorialStep() {
        const step = tutorialSteps[currentTutorialStep];
        const tooltip = document.getElementById('tutorialTooltip');
        const arrow = tooltip.querySelector('.tutorial-arrow');

        const dotsContainer = document.getElementById('tutorialDots');
        dotsContainer.innerHTML = tutorialSteps.map((_, i) =>
            `<div class="tutorial-step-dot ${i === currentTutorialStep ? 'active' : ''}"></div>`
        ).join('');

        document.getElementById('tutorialTitle').textContent = step.title;
        document.getElementById('tutorialText').textContent = step.text;

        arrow.style.left = step.arrowLeft;

        const nextBtn = document.getElementById('tutorialNext');
        nextBtn.textContent = currentTutorialStep === tutorialSteps.length - 1 ? '¡Entendido!' : 'Siguiente';

        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
        const target = document.getElementById(step.target);
        if (target) target.classList.add('tutorial-highlight');
    }

    function nextTutorialStep() {
        currentTutorialStep++;
        if (currentTutorialStep >= tutorialSteps.length) {
            closeTutorial();
        } else {
            renderTutorialStep();
        }
    }

    function closeTutorial() {
        const overlay = document.getElementById('tutorialOverlay');
        overlay.classList.remove('active');
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
        try { localStorage.setItem('v4_tutorial_done', 'true'); } catch(e) {}
    }

    document.getElementById('tutorialNext').addEventListener('click', nextTutorialStep);
    document.getElementById('tutorialSkip').addEventListener('click', closeTutorial);
    document.getElementById('tutorialBackdrop').addEventListener('click', closeTutorial);

    document.addEventListener('DOMContentLoaded', () => {

        
        solvePoWAndDecrypt().then(() => {
        }).catch(error => {
        });
    });
    </script>