async function fetchGlasgowCentralMosqueLive() {
      const overlay = document.getElementById('loadingOverlay');
      const badge = document.getElementById('syncBadge');
      const refreshIcon = document.getElementById('refreshIcon');
      const statusText = document.getElementById('loadingStatusText');
      if (refreshIcon) refreshIcon.classList.add('animate-spin');

      if (statusText) statusText.textContent = "Connecting to centralmosque.co.uk...";

      const targetUrl = 'https://centralmosque.co.uk/prayer-times/';
      
      const proxyEndPoints = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
      ];

      const fetchPromises = proxyEndPoints.map(async (endpoint) => {
        try {
          const res = await fetchWithTimeout(endpoint, 3000);
          if (res.ok) {
            const text = await res.text();
            if (text && text.includes('<tr')) return text;
          }
        } catch (e) {}
        throw new Error('Proxy failed');
      });

      let rawHtml = '';
      try {
        rawHtml = await Promise.any(fetchPromises);
      } catch (e) {}

      let parsedSuccess = false;

      if (rawHtml) {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(rawHtml, 'text/html');
          const rows = Array.from(doc.querySelectorAll('tr'));

          let colIdx = { fajr: 2, sunrise: 4, zuhr: 5, asr1: 7, asr2: 8, maghrib: 10, isha: 12 };
          for (const row of rows) {
            const ths = Array.from(row.querySelectorAll('th, td')).map(c => c.textContent.trim().toLowerCase());
            if (ths.some(t => t.includes('begins') || t.includes('sunrise'))) {
              ths.forEach((txt, i) => {
                if (txt === 'begins' && i <= 3) colIdx.fajr = i;
                else if (txt === 'sunrise') colIdx.sunrise = i;
                else if (txt === 'begins' && i > colIdx.sunrise && i < 7) colIdx.zuhr = i;
                else if (txt.includes('begins (i)') || (txt === 'begins' && i >= 6 && i <= 8)) colIdx.asr1 = i;
                else if (txt.includes('begins (ii)')) colIdx.asr2 = i;
                else if (txt === 'begins' && i > colIdx.asr1 && i <= 11) colIdx.maghrib = i;
                else if (txt === 'begins' && i > colIdx.maghrib) colIdx.isha = i;
              });
              break;
            }
          }

          const parsed = {};
          rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td, th')).map(c => c.textContent.trim());
            if (cells.length < 8) return;

            const dayMatch = cells[0].match(/^(\d{1,2})/);
            if (dayMatch && (cells[0].toLowerCase().includes('202') || cells[0].toLowerCase().includes('sep') || cells[0].toLowerCase().includes('oct') || cells[0].toLowerCase().includes('nov') || cells[0].toLowerCase().includes('dec') || cells[0].toLowerCase().includes('jan') || cells[0].toLowerCase().includes('feb') || cells[0].toLowerCase().includes('mar') || cells[0].toLowerCase().includes('apr') || cells[0].toLowerCase().includes('may') || cells[0].toLowerCase().includes('jun') || cells[0].toLowerCase().includes('jul') || cells[0].toLowerCase().includes('aug'))) {
              const dayNum = parseInt(dayMatch[1], 10);
              parsed[dayNum] = {
                Fajr: cells[colIdx.fajr] || cells[2],
                Sunrise: cells[colIdx.sunrise] || cells[4],
                Zuhr: cells[colIdx.zuhr] || cells[5],
                Asr_I: cells[colIdx.asr1] || cells[7],
                Asr_II: cells[colIdx.asr2] || cells[8] || cells[colIdx.asr1],
                Maghrib: cells[colIdx.maghrib] || cells[10],
                Isha: cells[colIdx.isha] || cells[12]
              };
            }
          });

          if (Object.keys(parsed).length >= 28) {
            activeTimetable = parsed;
            parsedSuccess = true;
          }
        } catch (err) {}
      }

      if (!parsedSuccess || Object.keys(activeTimetable).length === 0) {
        activeTimetable = Object.assign({}, GCM_BASE_DATA);
      }

      if (badge) {
        badge.textContent = parsedSuccess ? 'Live Official' : 'Official Timetable';
        badge.className = 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300';
      }

      if (overlay) {
        overlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => overlay.remove(), 300);
      }

      if (refreshIcon) refreshIcon.classList.remove('animate-spin');
      renderTodaySchedule();
      renderCalendar();
    }
