import * as Runtime from './game-runtime.js';
const E=Runtime.E;
let live=await Runtime.open();
let nativeReady=false,uiBusy=false,saveQueue=Promise.resolve(),activeStory=null,activeEpisode=0,activeStoryKey='',nativeSlot=null;
document.querySelector('#characters-screen .character-card-grid').innerHTML=live.owned.map(id=>Runtime.cardMarkup(live,live.catalog.find(c=>c.id===id))).join('');

      const connectionListView = document.getElementById('connection-list-view');
      const connectionEditor = document.getElementById('connection-editor-view');
      const connectionForm = document.getElementById('connection-form');
      const modelType = document.getElementById('connection-model-type');
      document.querySelectorAll('[data-slider-pair]').forEach(pair => {
        const slider = pair.querySelector('input[type="range"]');
        const number = pair.querySelector('input[type="number"]');
        slider.addEventListener('input', () => { number.value = slider.value; });
        number.addEventListener('input', () => {
          if (number.value !== '' && number.validity.valid) slider.value = number.value;
        });
        const normalizeNumber = () => {
          const min = Number(number.min);
          const max = Number(number.max);
          const step = Number(number.step);
          const parsed = number.valueAsNumber;
          const bounded = Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : Number(slider.value);
          const rounded = Math.max(min, Math.min(max, Number((min + Math.round((bounded - min) / step) * step).toFixed(4))));
          slider.value = String(rounded);
          number.value = slider.value;
        };
        number.addEventListener('change', normalizeNumber);
        number.addEventListener('blur', normalizeNumber);
      });
      const imageCapabilities = {"v5-full":{"uc":["heavy","light","furry-focus","human-focus","none"],"quality":["standard","light","none"]},"v5-curated":{"uc":["heavy","light","furry-focus","human-focus","none"],"quality":["standard","light","none"]},"v4-5-full":{"uc":["heavy","light","furry-focus","human-focus","none"],"quality":["standard","none"]},"v4-5-curated":{"uc":["heavy","light","human-focus","none"],"quality":["standard","none"]},"v4-full":{"uc":["heavy","light","none"],"quality":["standard","none"]},"v4-curated":{"uc":["heavy","light","none"],"quality":["standard","none"]},"anime-v3":{"uc":["heavy","light","human-focus","none"],"quality":["standard","none"]},"furry-v3":{"uc":["heavy","light","none"],"quality":["standard","none"]}};
      function updateImagePresets() {
        const capabilities = imageCapabilities[document.getElementById('connection-image-model').value];
        for (const [id, supported] of [['image-uc-preset', capabilities.uc], ['image-quality-tags', capabilities.quality]]) {
          const select = document.getElementById(id);
          for (const option of select.options) option.disabled = !supported.includes(option.value);
          if (!supported.includes(select.value)) select.value = id === 'image-uc-preset' ? 'none' : 'standard';
        }
      }
      document.getElementById('connection-image-model').addEventListener('change', updateImagePresets);
      const imageTestButton = document.getElementById('test-image-connection');
      const imageStatus = document.getElementById('image-test-status');
      const imageThumbnail = document.getElementById('image-test-thumbnail');
      const imageResult = document.getElementById('image-test-image');
      const imageDialog = document.getElementById('image-preview-dialog');
      let pendingImageTest = null;
      let imageTestVersion = 0;
      function resetImageTest(clearImage = false) {
        imageTestVersion++;
        pendingImageTest?.abort();
        pendingImageTest = null;
        imageTestButton.disabled = modelType.value !== 'image';
        imageTestButton.textContent = '이미지 테스트';
        imageTestButton.setAttribute('aria-busy', 'false');
        imageStatus.hidden = true;
        if (clearImage) {
          imageThumbnail.hidden = true;
          imageResult.removeAttribute('src');
          document.getElementById('image-preview-original').removeAttribute('src');
          if (imageDialog.open) imageDialog.close();
        }
      }
      function imageStatusMessage(state, title, message) {
        imageStatus.dataset.state = state;
        document.getElementById('image-test-title').textContent = title;
        document.getElementById('image-test-message').textContent = message;
        imageStatus.hidden = false;
        requestAnimationFrame(() => { if (!imageStatus.hidden) imageStatus.scrollIntoView({block:'nearest'}); });
      }
      modelType.addEventListener('change', () => resetImageTest());
      imageThumbnail.addEventListener('click', () => {
        document.getElementById('image-preview-original').src = imageResult.src;
        imageDialog.showModal();
        document.getElementById('image-preview-scroll').scrollTo(0, 0);
      });
      document.getElementById('image-preview-close').addEventListener('click', () => imageDialog.close());
      imageTestButton.addEventListener('click', async () => {
        if (pendingImageTest || modelType.value !== 'image') return;
        const version = ++imageTestVersion;
        const token = document.getElementById('connection-api-key').value.trim();
        const body = { token, id: editingConnectionId, model: document.getElementById('connection-image-model').value, ...readImageSettings() };
        try {
          if (!token && !editingConnectionId) throw new Error('API KEY에 NovelAI Persistent API Token을 입력해 주세요.');
          if (location.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(location.hostname)) throw new Error('이미지 테스트는 PC의 로컬 게임 주소에서 사용해 주세요.');
          const controller = new AbortController();
          pendingImageTest = controller;
          imageTestButton.disabled = true;
          imageTestButton.textContent = '이미지 생성 중…';
          imageTestButton.setAttribute('aria-busy', 'true');
          imageStatusMessage('pending','이미지 생성 중','선택한 설정으로 1024 × 1024 이미지 한 장을 요청하고 있어요.');
          const response = await fetch('/api/images/test', {
            method:'POST', cache:'no-store', headers:{'Content-Type':'application/json'},
            signal:AbortSignal.any([controller.signal,AbortSignal.timeout(185000)]),
            body:JSON.stringify(body),
          });
          let data;
          try { data = await response.json(); } catch { throw new Error('이미지 테스트 서버의 응답을 읽지 못했습니다. 로컬 서버를 다시 실행해 주세요.'); }
          if (version !== imageTestVersion) return;
          if (!response.ok || !data.ok) throw new Error(data.error?.message || '이미지 생성에 실패했습니다.');
          if (typeof data.image !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(data.image)) throw new Error('올바른 이미지 응답이 아닙니다.');
          const loaded = new Image();
          loaded.src = data.image;
          await loaded.decode();
          if (version !== imageTestVersion) return;
          if (loaded.naturalWidth !== 1024 || loaded.naturalHeight !== 1024) throw new Error('이미지 크기가 1024 × 1024가 아닙니다.');
          imageResult.src = data.image;
          imageThumbnail.hidden = false;
          imageStatusMessage('success','이미지 생성 성공','썸네일을 누르면 원본 크기로 볼 수 있어요.');
          requestAnimationFrame(() => imageThumbnail.scrollIntoView({block:'nearest'}));
        } catch (error) {
          if (version === imageTestVersion) imageStatusMessage('error','이미지 생성 실패',error.name === 'TimeoutError' ? '이미지 생성 시간이 초과됐습니다. 처리 여부를 확인한 후 다시 시도해 주세요.' : error instanceof TypeError ? '로컬 서버 또는 NovelAI 연결을 확인해 주세요.' : error.message || '이미지를 생성하지 못했습니다.');
        } finally {
          if (version === imageTestVersion) {
            pendingImageTest = null;
            imageTestButton.disabled = modelType.value !== 'image';
            imageTestButton.textContent = '이미지 테스트';
            imageTestButton.setAttribute('aria-busy', 'false');
          }
        }
      });
      let editingConnectionId = null;
      let savingConnection = false;
      let savedConnections = [];
      const editorFooter = document.getElementById('connection-editor-footer');
      const saveButton = document.getElementById('save-connection');
      const saveStatus = document.getElementById('connection-save-status');
      const textModelFields = document.getElementById('text-model-fields');
      function updateModelFields() {
        const isTextModel = modelType.value === 'text';
        textModelFields.hidden = !isTextModel;
        const imageModelFields = document.getElementById('image-model-fields');
        imageModelFields.hidden = isTextModel;
        imageModelFields.querySelectorAll('input, select, textarea, button').forEach(control => { control.disabled = isTextModel; });
        if (!isTextModel) updateImagePresets();
        imageTestButton.disabled = isTextModel || Boolean(pendingImageTest);
        editorFooter.hidden = connectionEditor.hidden;
        const vertexKey = document.getElementById('connection-vertex-key');
        const imageKey = document.getElementById('connection-api-key');
        vertexKey.hidden = !isTextModel;
        vertexKey.disabled = !isTextModel;
        imageKey.hidden = isTextModel;
        imageKey.disabled = isTextModel;
        document.getElementById('connection-key-label').htmlFor = isTextModel ? 'connection-vertex-key' : 'connection-api-key';
        textModelFields.querySelectorAll('input, select, button').forEach((control) => {
          control.disabled = !isTextModel;
        });
      }
      modelType.addEventListener('change', updateModelFields);
      const apiKey = document.getElementById('connection-api-key');
      document.querySelector('.add-ai-button').addEventListener('click', () => {
        resetImageTest(true);
        editingConnectionId = null;
        connectionForm.reset();
        saveStatus.textContent = '';
        document.getElementById('connection-vertex-key').placeholder = 'Google Vertex AI JSON 키 전체를 붙여넣으세요.';
        document.getElementById('connection-api-key').placeholder = 'NovelAI Persistent API Token';
        modelType.value = document.getElementById('image-ai-tab').getAttribute('aria-selected') === 'true' ? 'image' : 'text';
        updateModelFields();
        connectionListView.hidden = true;
        connectionEditor.hidden = false;
        updateModelFields();
        modelType.focus();
      });
      const testButton = document.getElementById('test-connection');
      const resultBox = document.getElementById('connection-test-result');
      const resultTitle = document.getElementById('connection-test-title');
      const resultMessage = document.getElementById('connection-test-message');
      let pendingTest = null;
      let testVersion = 0;
      function resetConnectionTest() {
        testVersion++;
        pendingTest?.abort();
        pendingTest = null;
        testButton.disabled = modelType.value !== 'text';
        testButton.textContent = '테스트 메시지 전송';
        testButton.setAttribute('aria-busy', 'false');
        resultBox.hidden = true;
        resultTitle.textContent = '';
        resultMessage.textContent = '';
      }
      function showConnectionResult(state, title, message) {
        resultBox.dataset.state = state;
        resultTitle.textContent = title;
        resultMessage.textContent = message;
        resultBox.hidden = false;
        requestAnimationFrame(() => { if (!resultBox.hidden) resultBox.scrollIntoView({ block: 'nearest' }); });
      }
      connectionForm.addEventListener('input', resetConnectionTest);
      connectionForm.addEventListener('change', resetConnectionTest);
      testButton.addEventListener('click', async () => {
        if (pendingTest || modelType.value !== 'text') return;
        resetConnectionTest();
        const version = testVersion;
        const credentials = document.getElementById('connection-vertex-key').value.trim();
        const model = document.getElementById('connection-model').value.trim();
        const region = document.getElementById('connection-region').value;
        try {
          if (!credentials && !editingConnectionId) throw new Error('API KEY에 Vertex AI 서비스 계정 JSON 키 전체를 입력해 주세요.');
          if (credentials) {
          let key;
          try { key = JSON.parse(credentials); }
          catch { throw new Error('API KEY의 JSON 형식이 올바르지 않습니다. 키 전체를 복사했는지 확인해 주세요.'); }
          if (!key || key.type !== 'service_account' || !key.project_id || !key.client_email || !key.private_key) {
            throw new Error('서비스 계정 JSON 키의 type, project_id, client_email, private_key를 확인해 주세요.');
          }
          }
          if (!model) throw new Error('호출할 모델 ID를 입력해 주세요.');
          if (location.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(location.hostname)) {
            throw new Error('연결 테스트는 PC의 로컬 서버에서 실행해 주세요. 저장소 폴더에서 npm start를 실행한 뒤 표시되는 로컬 주소로 접속하면 됩니다.');
          }
          const controller = new AbortController();
          pendingTest = controller;
          testButton.disabled = true;
          testButton.textContent = '테스트 중…';
          testButton.setAttribute('aria-busy', 'true');
          showConnectionResult('pending', '연결 테스트 중', '모델에 hello를 보내고 응답을 기다리고 있어요.');
          let response;
          try {
            response = await fetch('/api/connections/test', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              cache: 'no-store',
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65000)]),
              body: JSON.stringify({ credentials, model, region, id: editingConnectionId }),
            });
          } catch (error) {
            if (controller.signal.aborted) return;
            throw new Error(error.name === 'TimeoutError' ? '연결 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.' : '로컬 서버에 연결하지 못했습니다. 게임 서버가 실행 중인지 확인해 주세요.');
          }
          let data;
          try { data = await response.json(); }
          catch { throw new Error('연결 테스트 서버를 찾지 못했습니다. 화면 미리보기 서버 대신 npm start로 게임 서버를 실행해 주세요.'); }
          if (version !== testVersion) return;
          if (!response.ok || !data.ok) throw new Error(data.error?.message || '연결 테스트에 실패했습니다.');
          if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('모델이 텍스트 응답을 반환하지 않았습니다.');
          showConnectionResult('success', '연결 성공', data.text);
        } catch (error) {
          if (version === testVersion) showConnectionResult('error', '연결 실패', error.message || '연결 테스트에 실패했습니다.');
        } finally {
          if (version === testVersion) {
            pendingTest = null;
            testButton.disabled = modelType.value !== 'text';
            testButton.textContent = '테스트 메시지 전송';
            testButton.setAttribute('aria-busy', 'false');
          }
        }
      });
      function readImageSettings() {
        return {
          prefix: document.getElementById('connection-image-prefix').value,
          suffix: document.getElementById('connection-image-suffix').value,
          negativePrefix: document.getElementById('connection-image-negative-prefix').value,
          steps: document.getElementById('image-steps-number').valueAsNumber,
          guidance: document.getElementById('image-guidance-number').valueAsNumber,
          rescale: document.getElementById('image-rescale-number').valueAsNumber,
          ucPreset: document.getElementById('image-uc-preset').value,
          qualityTags: document.getElementById('image-quality-tags').value,
        };
      }
      function restoreImageSettings(settings) {
        document.getElementById('connection-image-prefix').value = settings.prefix;
        document.getElementById('connection-image-suffix').value = settings.suffix;
        document.getElementById('connection-image-negative-prefix').value = settings.negativePrefix;
        for (const [key, id] of [['steps','steps'],['guidance','guidance'],['rescale','rescale']]) {
          document.getElementById('image-' + id + '-number').value = settings[key];
          document.getElementById('image-' + id + '-range').value = settings[key];
        }
        document.getElementById('image-uc-preset').value = settings.ucPreset;
        document.getElementById('image-quality-tags').value = settings.qualityTags;
      }
      async function loadSavedConnections() {
        const statuses = [document.getElementById('connection-list-status'), document.getElementById('image-connection-list-status')];
        if (location.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(location.hostname)) return;
        try {
          const response = await fetch('/api/connections', { cache: 'no-store' });
          const data = await response.json();
          if (!response.ok || !data.ok || !Array.isArray(data.connections)) throw new Error(data.error?.message || '저장된 연결을 불러오지 못했습니다.');
          savedConnections = data.connections;
          refreshWorldModels();
          const textList = document.getElementById('saved-connections');
          const imageList = document.getElementById('saved-image-connections');
          textList.replaceChildren(); imageList.replaceChildren();
          for (const connection of savedConnections) {
            const isImage = connection.provider === 'novelai';
            const card = document.createElement('article');
            card.className = 'saved-connection';
            const info = document.createElement('div');
            const title = document.createElement('strong');
            title.textContent = connection.name;
            const detail = document.createElement('p');
            const imageModelName = Array.from(document.getElementById('connection-image-model').options).find(option => option.value === connection.model)?.textContent;
            detail.textContent = isImage ? imageModelName || connection.model : connection.model + ' · ' + connection.region;
            info.append(title, detail);
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.textContent = '수정';
            edit.setAttribute('aria-label', connection.name + ' 수정');
            edit.addEventListener('click', () => {
              resetConnectionTest(); resetImageTest(true);
              connectionForm.reset();
              editingConnectionId = connection.id;
              modelType.value = isImage ? 'image' : 'text';
              if (isImage) {
                document.getElementById('connection-image-name').value = connection.name;
                document.getElementById('connection-image-model').value = connection.model;
                restoreImageSettings(connection.settings);
                document.getElementById('connection-api-key').placeholder = '저장된 키를 사용합니다. 키를 바꿀 때만 새 토큰을 입력하세요.';
              } else {
                document.getElementById('connection-name').value = connection.name;
                document.getElementById('connection-model').value = connection.model;
                document.getElementById('connection-region').value = connection.region;
                document.getElementById('connection-vertex-key').placeholder = '저장된 JSON 키를 사용합니다. 키를 변경할 때만 새 JSON을 입력하세요.';
              }
              saveStatus.textContent = '';
              connectionListView.hidden = true;
              connectionEditor.hidden = false;
              updateModelFields();
              document.getElementById(isImage ? 'connection-image-name' : 'connection-name').focus();
            });
            card.append(info, edit);
            (isImage ? imageList : textList).append(card);
          }
          statuses.forEach(status => { status.textContent = ''; });
        } catch (error) {
          statuses.forEach(status => { status.textContent = error.message || '저장된 연결을 불러오지 못했습니다.'; });
        }
      }
      saveButton.addEventListener('click', async () => {
        if (savingConnection) return;
        const isImage = modelType.value === 'image';
        resetConnectionTest();
        resetImageTest();
        saveStatus.dataset.state = '';
        saveStatus.textContent = '';
        const name = document.getElementById(isImage ? 'connection-image-name' : 'connection-name').value.trim();
        const credentials = document.getElementById(isImage ? 'connection-api-key' : 'connection-vertex-key').value.trim();
        const model = document.getElementById(isImage ? 'connection-image-model' : 'connection-model').value.trim();
        const region = isImage ? undefined : document.getElementById('connection-region').value;
        const settings = isImage ? readImageSettings() : undefined;
        try {
          if (!name || name.length > 80) throw new Error('이름은 1~80자로 입력해 주세요.');
          if (!model) throw new Error('모델을 선택하거나 모델 ID를 입력해 주세요.');
          if (!credentials && !editingConnectionId) throw new Error('저장할 API KEY를 입력해 주세요.');
          if (location.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('연결 저장은 PC의 로컬 게임 주소에서 사용해 주세요.');
          savingConnection = true;
          connectionForm.inert = true;
          document.getElementById('connection-back').disabled = true;
          saveButton.disabled = true;
          saveButton.textContent = '저장 중…';
          const response = await fetch('/api/connections', {
            method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingConnectionId, provider: isImage ? 'novelai' : 'vertex', name, credentials, model, region, settings }),
          });
          let data;
          try { data = await response.json(); } catch { throw new Error('로컬 저장 서버를 찾지 못했습니다. 게임 서버를 다시 실행해 주세요.'); }
          if (!response.ok || !data.ok) throw new Error(data.error?.message || '연결을 저장하지 못했습니다.');
          savingConnection = false;
          returnToConnectionList();
          selectTab(document.getElementById(isImage ? 'image-ai-tab' : 'text-ai-tab'));
          await loadSavedConnections();
          document.getElementById(isImage ? 'image-connection-list-status' : 'connection-list-status').textContent = name + ' 연결을 이 PC에 저장했어요.';
        } catch (error) {
          saveStatus.dataset.state = 'error';
          saveStatus.textContent = error.message || '저장하지 못했습니다. 로컬 서버 연결을 확인해 주세요.';
        } finally {
          savingConnection = false;
          connectionForm.inert = false;
          document.getElementById('connection-back').disabled = false;
          saveButton.disabled = false;
          saveButton.textContent = '저장';
        }
      });
      loadSavedConnections();
      connectionForm.addEventListener('submit', (event) => event.preventDefault());
      function returnToConnectionList() {
        if (connectionEditor.hidden || savingConnection) return;
        resetConnectionTest();
        resetImageTest(true);
        connectionForm.reset();
        updateModelFields();
        apiKey.value = '';
        connectionEditor.hidden = true;
        editorFooter.hidden = true;
        editingConnectionId = null;
        connectionListView.hidden = false;
        document.querySelector('.add-ai-button').focus();
      }
      document.getElementById('connection-back').addEventListener('click', returnToConnectionList);
      const worldNav = document.getElementById('worlds-nav');
      const loreNav = document.getElementById('lorebook-nav');
      const aiNav = document.getElementById('ai-connection-nav');
      const gameNav = document.getElementById('game-nav');
      let partyFormationMenuTarget = null;
      function showSection(section) {
        if (savingConnection) return;
        returnToConnectionList();
        const isWorlds = section === 'worlds';
        const isLorebook = section === 'lorebook';
        const isGame = section === 'game-preview';
        if (isGame) showGameView('home');
        document.querySelector('.game-frame').dataset.screen = isGame ? 'game' : 'settings';
        document.querySelector('main.content').setAttribute('aria-label', isGame ? '게임 화면' : '게임 설정');
        if (isGame) document.querySelector('main.content').removeAttribute('aria-labelledby');
        else document.querySelector('main.content').setAttribute('aria-labelledby', 'page-title');
        document.getElementById('game-preview').hidden = !isGame;
        document.getElementById('worlds').hidden = !isWorlds;
        document.getElementById('lorebook').hidden = !isLorebook;
        document.getElementById('lore-editor-footer').hidden = !isLorebook || document.getElementById('lore-editor').hidden;
        document.getElementById('ai-connection-body').hidden = isWorlds || isLorebook || isGame;
        document.getElementById('world-footer').hidden = !isWorlds || document.getElementById('world-editor').hidden;
        editorFooter.hidden = true;
        document.getElementById('page-title').textContent = isGame ? '' : isWorlds ? '세계관' : isLorebook ? '로어북' : 'AI 연결';
        document.getElementById('page-description').textContent = isWorlds
          ? '나만의 세계관을 만들고, 이어서 플레이하세요.'
          : isLorebook ? '세계와 캐릭터의 설정을 모아두는 공간이에요.'
          : isGame ? ''
          : '스토리를 만드는 AI와 이미지를 그리는 AI를 연결하세요.';
        for (const [link, selected] of [[worldNav, isWorlds], [loreNav, isLorebook], [aiNav, !isWorlds && !isLorebook && !isGame], [gameNav, isGame]]) {
          if (selected) link.setAttribute('aria-current', 'page');
          else link.removeAttribute('aria-current');
        }
      }
      for (const [link, section] of [[worldNav, 'worlds'], [loreNav, 'lorebook'], [aiNav, 'ai-connection'], [gameNav, 'game-preview']]) {
        link.addEventListener('click', event => {
          event.preventDefault();
          if (savingConnection) return;
          showSection(section);
          history.replaceState(null, '', '#' + section);
        });
      }
      function sectionFromHash() {
        return ['#worlds', '#lorebook', '#game-preview'].includes(location.hash) ? location.hash.slice(1) : 'ai-connection';
      }
      window.addEventListener('hashchange', () => showSection(sectionFromHash()));
      document.getElementById('game-settings').addEventListener('click', () => {
        showSection('worlds');
        history.replaceState(null, '', '#worlds');
        worldNav.focus();
      });
      const tabs = Array.from(document.querySelectorAll('.ai-tab'));
      function selectTab(selectedTab) {
        tabs.forEach((tab) => {
          const isSelected = tab === selectedTab;
          tab.setAttribute('aria-selected', String(isSelected));
          tab.tabIndex = isSelected ? 0 : -1;
          document.getElementById(tab.getAttribute('aria-controls')).hidden = !isSelected;
        });
      }
      tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => selectTab(tab));
        tab.addEventListener('keydown', (event) => {
          let nextIndex;
          if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
          else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
          else if (event.key === 'Home') nextIndex = 0;
          else if (event.key === 'End') nextIndex = tabs.length - 1;
          else return;
          event.preventDefault();
          selectTab(tabs[nextIndex]);
          tabs[nextIndex].focus();
        });
      });

      const loreTabs = Array.from(document.querySelectorAll('.lore-tab'));
      function selectLoreTab(selectedTab) {
        loreTabs.forEach(tab => {
          const selected = tab === selectedTab;
          tab.setAttribute('aria-selected', String(selected));
          tab.tabIndex = selected ? 0 : -1;
          document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
        });
        renderLoreFolders();
      }
      loreTabs.forEach((tab, index) => {
        tab.addEventListener('click', () => selectLoreTab(tab));
        tab.addEventListener('keydown', event => {
          let nextIndex;
          if (event.key === 'ArrowRight') nextIndex = (index + 1) % loreTabs.length;
          else if (event.key === 'ArrowLeft') nextIndex = (index + loreTabs.length - 1) % loreTabs.length;
          else if (event.key === 'Home') nextIndex = 0;
          else if (event.key === 'End') nextIndex = loreTabs.length - 1;
          else return;
          event.preventDefault();
          selectLoreTab(loreTabs[nextIndex]);
          loreTabs[nextIndex].focus();
        });
      });

      const loreEntryStorageKey = 'gacha-game.lore-entries.v1';
      let loreEntries = [];
      try {
        const stored = JSON.parse(localStorage.getItem(loreEntryStorageKey) || '[]');
        if (Array.isArray(stored)) loreEntries = stored.filter(entry => entry && typeof entry.id === 'string' && loreTabs.some(tab => tab.id === entry.type) && typeof entry.name === 'string' && typeof entry.description === 'string' && Array.isArray(entry.sections) && entry.sections.every(section => section && typeof section.id === 'string' && typeof section.name === 'string' && typeof section.description === 'string'));
      } catch { /* 저장된 로어북 형식이 잘못되면 빈 목록으로 시작합니다. */ }
      const folderStorageKey = 'gacha-game.lore-folders.v1';
      const folderDialog = document.getElementById('folder-dialog');
      const folderName = document.getElementById('folder-name');
      const folderError = document.getElementById('folder-error');
      let loreFolders = {};
      try {
        const stored = JSON.parse(localStorage.getItem(folderStorageKey) || '{}');
        for (const tab of loreTabs) {
          const list = stored?.[tab.id];
          loreFolders[tab.id] = Array.isArray(list) ? list.filter(folder => folder && typeof folder.id === 'string' && typeof folder.name === 'string' && folder.name.trim().length > 0 && folder.name.length <= 80).map(folder => ({ id: folder.id, name: folder.name })) : [];
        }
      } catch { loreFolders = {}; }
      const selectedFolders = {};
      let folderTargetTab = null;
      let editingFolderId = null;
      const folderMenu = document.getElementById('folder-menu');
      const folderDeleteDialog = document.getElementById('folder-delete-dialog');
      let folderMenuTarget = null;
      let folderDeleteTarget = null;
      function closeFolderMenu(restoreFocus = false) {
        folderMenu.hidden = true;
        if (restoreFocus) folderMenuTarget?.button.focus();
      }
      function openFolderMenu(event, tab, folder, button) {
        event.preventDefault();
        folderMenuTarget = { tab, folder, button };
        folderMenu.hidden = false;
        const rect = button.getBoundingClientRect();
        const x = event.type === 'contextmenu' && event.clientX ? event.clientX : rect.left;
        const y = event.type === 'contextmenu' && event.clientY ? event.clientY : rect.bottom;
        folderMenu.style.left = Math.max(8, Math.min(x, window.innerWidth - folderMenu.offsetWidth - 8)) + 'px';
        folderMenu.style.top = Math.max(8, Math.min(y, window.innerHeight - folderMenu.offsetHeight - 8)) + 'px';
        folderMenu.querySelector('button').focus();
      }
      function renderLoreFolders(focusId) {
        const tab = loreTabs.find(item => item.getAttribute('aria-selected') === 'true');
        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        const folders = [...(loreFolders[tab.id] || [])];
        if (loreEntries.some(entry => entry.type === tab.id && !folders.some(folder => folder.id === entry.folderId))) folders.push({ id: '', name: '미분류' });
        panel.replaceChildren();
        if (!folders.length) { renderLoreEntryList(panel, tab.id, ''); return; }
        if (!folders.some(folder => folder.id === selectedFolders[tab.id])) selectedFolders[tab.id] = folders[0].id;
        const row = document.createElement('div');
        row.className = 'folder-tabs';
        row.setAttribute('role', 'tablist');
        row.setAttribute('aria-label', tab.textContent + ' 폴더');
        const content = document.createElement('div');
        content.id = tab.id + '-folder-content';
        content.setAttribute('role', 'tabpanel');
        content.tabIndex = 0;
        folders.forEach((folder, index) => {
          const button = document.createElement('button');
          button.className = 'folder-tab';
          button.type = 'button';
          button.id = 'folder-' + folder.id;
          button.textContent = folder.name;
          button.title = folder.name;
          button.setAttribute('aria-haspopup', 'menu');
          button.addEventListener('contextmenu', event => openFolderMenu(event, tab, folder, button));
          button.setAttribute('role', 'tab');
          button.setAttribute('aria-controls', content.id);
          const selected = folder.id === selectedFolders[tab.id];
          button.setAttribute('aria-selected', String(selected));
          button.tabIndex = selected ? 0 : -1;
          if (selected) content.setAttribute('aria-labelledby', button.id);
          button.addEventListener('click', () => {
            selectedFolders[tab.id] = folder.id;
            renderLoreFolders(folder.id);
          });
          button.addEventListener('keydown', event => {
            if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
              openFolderMenu(event, tab, folder, button);
              return;
            }
            let next;
            if (event.key === 'ArrowRight') next = (index + 1) % folders.length;
            else if (event.key === 'ArrowLeft') next = (index + folders.length - 1) % folders.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = folders.length - 1;
            else return;
            event.preventDefault();
            selectedFolders[tab.id] = folders[next].id;
            renderLoreFolders(folders[next].id);
          });
          row.append(button);
        });
        panel.append(row, content);
        renderLoreEntryList(content, tab.id, selectedFolders[tab.id]);
        if (focusId) Array.from(row.children).find(button => button.id === 'folder-' + focusId)?.focus();
      }
      document.getElementById('add-lore-folder').addEventListener('click', () => {
        closeFolderMenu();
        editingFolderId = null;
        folderTargetTab = loreTabs.find(tab => tab.getAttribute('aria-selected') === 'true');
        document.getElementById('folder-form').reset();
        folderError.textContent = '';
        document.getElementById('folder-dialog-title').textContent = folderTargetTab.textContent + ' 폴더 추가';
        folderDialog.showModal();
        folderName.focus();
      });
      document.getElementById('folder-cancel').addEventListener('click', () => folderDialog.close());
      document.getElementById('folder-form').addEventListener('submit', event => {
        event.preventDefault();
        const name = folderName.value.trim();
        if (!name) { folderError.textContent = '폴더 이름을 입력해 주세요.'; folderName.focus(); return; }
        const folders = loreFolders[folderTargetTab.id] || [];
        if (folders.some(folder => folder.name === name && folder.id !== editingFolderId)) { folderError.textContent = '이 탭에 같은 이름의 폴더가 있어요.'; folderName.focus(); return; }
        const folder = { id: editingFolderId || crypto.randomUUID(), name };
        const updated = { ...loreFolders, [folderTargetTab.id]: editingFolderId ? folders.map(item => item.id === editingFolderId ? folder : item) : [...folders, folder] };
        try { localStorage.setItem(folderStorageKey, JSON.stringify(updated)); }
        catch { folderError.textContent = '폴더를 저장하지 못했어요. 브라우저의 저장 공간 설정을 확인해 주세요.'; return; }
        loreFolders = updated;
        selectedFolders[folderTargetTab.id] = folder.id;
        folderDialog.close();
        renderLoreFolders(folder.id);
      });
      folderMenu.addEventListener('click', event => {
        const action = event.target.closest('button')?.dataset.action;
        if (!action || !folderMenuTarget) return;
        const { tab, folder } = folderMenuTarget;
        closeFolderMenu();
        if (action === 'rename') {
          folderTargetTab = tab;
          editingFolderId = folder.id;
          folderName.value = folder.name;
          folderError.textContent = '';
          document.getElementById('folder-dialog-title').textContent = '폴더 이름 변경';
          folderDialog.showModal();
          folderName.focus();
          folderName.select();
        } else {
          folderDeleteTarget = { tab, folder };
          document.getElementById('folder-delete-message').textContent = "'" + folder.name + "' 폴더를 삭제하시겠습니까?";
          document.getElementById('folder-delete-error').textContent = '';
          folderDeleteDialog.showModal();
          document.getElementById('folder-delete-cancel').focus();
        }
      });
      folderMenu.addEventListener('keydown', event => {
        const items = Array.from(folderMenu.querySelectorAll('button'));
        const index = items.indexOf(document.activeElement);
        if (event.key === 'Escape') { event.preventDefault(); closeFolderMenu(true); }
        else if (event.key === 'Tab') closeFolderMenu();
        else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
          items[next].focus();
        }
      });
      document.addEventListener('pointerdown', event => { if (!folderMenu.contains(event.target)) closeFolderMenu(); });
      document.addEventListener('contextmenu', event => { if (!event.target.closest('.folder-tab')) closeFolderMenu(); });
      document.addEventListener('scroll', event => { if (!folderMenu.contains(event.target)) closeFolderMenu(); }, true);
      window.addEventListener('resize', () => closeFolderMenu());
      document.getElementById('folder-delete-cancel').addEventListener('click', () => folderDeleteDialog.close());
      document.getElementById('folder-delete-confirm').addEventListener('click', () => {
        if (!folderDeleteTarget) return;
        const { tab, folder } = folderDeleteTarget;
        const folders = loreFolders[tab.id] || [];
        const updated = { ...loreFolders, [tab.id]: folders.filter(item => item.id !== folder.id) };
        try { localStorage.setItem(folderStorageKey, JSON.stringify(updated)); }
        catch { document.getElementById('folder-delete-error').textContent = '삭제 내용을 저장하지 못했어요. 다시 시도해 주세요.'; return; }
        loreFolders = updated;
        if (selectedFolders[tab.id] === folder.id) delete selectedFolders[tab.id];
        folderDeleteDialog.close();
        folderDeleteTarget = null;
        renderLoreFolders();
        const selected = document.querySelector('#' + tab.getAttribute('aria-controls') + ' .folder-tab[aria-selected="true"]');
        (selected || document.getElementById('add-lore-folder')).focus();
      });
      for (const dialog of [folderDialog, folderDeleteDialog]) {
        dialog.addEventListener('close', () => {
          if (folderMenuTarget?.button.isConnected) folderMenuTarget.button.focus();
        });
      }
      renderLoreFolders();

      // 세계 설정은 현재 화면에만 보관하며, 이 단계에서는 AI 요청을 보내지 않습니다.
      const worldEditor = document.getElementById('world-editor');
      const worldList = document.getElementById('world-list-view');
      const worldFooter = document.getElementById('world-footer');
      const worldSteps = Array.from(document.querySelectorAll('.world-step'));
      let worldStepIndex = 0;
      function showWorldStep(index, focusTab = false) {
        worldStepIndex = index;
        worldSteps.forEach((tab, i) => {
          tab.setAttribute('aria-selected', String(i === index));
          tab.tabIndex = i === index ? 0 : -1;
          document.getElementById('world-panel-' + i).hidden = i !== index;
        });
        document.getElementById('world-previous').disabled = index === 0;
        document.getElementById('world-next').textContent = index === 6 ? '세계 생성' : '다음';
        document.getElementById('world-status').textContent='설정을 마친 뒤 세계 생성을 누르세요. API 이용량이 발생합니다.';
        document.getElementById('worlds').scrollTop = 0;
        if (focusTab) worldSteps[index].focus();
      }
      function refreshWorldModels() {
        for (const [id, provider, kind] of [['world-text-model', 'vertex', '텍스트'], ['world-image-model', 'novelai', '이미지']]) {
          const select = document.getElementById(id);
          const previous = select.value;
          const connections = savedConnections.filter(connection => provider === 'novelai' ? connection.provider === provider : connection.provider !== 'novelai');
          select.replaceChildren(new Option(connections.length ? '사용할 ' + kind + ' 모델을 선택하세요' : '저장된 ' + kind + ' 모델이 없어요', ''));
          connections.forEach(connection => select.add(new Option(connection.name + ' · ' + connection.model, connection.id)));
          if (connections.some(connection => connection.id === previous)) select.value = previous;
        }
      }
      document.getElementById('add-world').addEventListener('click', () => {
        refreshWorldModels();
        refreshWorldLorebooks();
        worldList.hidden = true;
        worldEditor.hidden = false;
        worldFooter.hidden = false;
        showWorldStep(worldStepIndex, true);
      });
      document.getElementById('world-back').addEventListener('click', () => {
        worldEditor.hidden = true;
        worldFooter.hidden = true;
        worldList.hidden = false;
        document.getElementById('add-world').focus();
      });
      worldSteps.forEach((tab, index) => {
        tab.addEventListener('click', () => showWorldStep(index));
        tab.addEventListener('keydown', event => {
          let next = index;
          if (event.key === 'ArrowRight') next = (index + 1) % 7;
          else if (event.key === 'ArrowLeft') next = (index + 6) % 7;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = 6;
          else return;
          event.preventDefault();
          showWorldStep(next, true);
        });
      });
      document.getElementById('world-form').addEventListener('submit', event => event.preventDefault());
      document.getElementById('world-previous').addEventListener('click', () => showWorldStep(Math.max(0, worldStepIndex - 1), true));
      document.getElementById('world-next').addEventListener('click', () => {
        if (worldStepIndex < 6) showWorldStep(worldStepIndex + 1, true);
        else nativeRun(nativeGenerate);
      });
      let loreDraft = null;
      let openLoreSectionId = null;
      let draggedLoreSectionId = null;
      function renderLoreEntryList(container, type, folderId) {
        const list = document.createElement('div');
        list.className = 'lore-entry-list';
        loreEntries.filter(entry => entry.type === type && ((loreFolders[type] || []).some(folder => folder.id === entry.folderId) ? entry.folderId : '') === folderId).forEach(entry => {
          const card = document.createElement('button');
          card.type = 'button'; card.className = 'lore-entry-card';
          const name = document.createElement('strong'); name.textContent = entry.name;
          const description = document.createElement('p'); description.textContent = entry.description;
          card.append(name, description);
          card.addEventListener('click', () => openLoreEditor(entry));
          list.append(card);
        });
        container.append(list);
      }
      function refreshLoreEntryFolders(preferred = '') {
        const select = document.getElementById('lore-entry-folder');
        const folders = loreFolders[document.getElementById('lore-entry-type').value] || [];
        select.replaceChildren(new Option(folders.length ? '선택 안 함' : '생성된 폴더가 없어요', ''));
        folders.forEach(folder => select.add(new Option(folder.name, folder.id)));
        select.disabled = !folders.length;
        select.value = folders.some(folder => folder.id === preferred) ? preferred : '';
      }
      function openLoreEditor(entry) {
        closeFolderMenu();
        const type = loreTabs.find(tab => tab.getAttribute('aria-selected') === 'true').id;
        loreDraft = entry ? structuredClone(entry) : { id: crypto.randomUUID(), type, folderId: selectedFolders[type] || '', name: '', description: '', sections: [{ id: crypto.randomUUID(), name: '새 섹션', description: '' }] };
        openLoreSectionId = loreDraft.sections[0]?.id || null;
        document.getElementById('lore-entry-type').value = loreDraft.type;
        refreshLoreEntryFolders(loreDraft.folderId);
        document.getElementById('lore-entry-name').value = loreDraft.name;
        document.getElementById('lore-entry-description').value = loreDraft.description;
        document.getElementById('lore-save-status').textContent = '';
        document.getElementById('lore-list-view').hidden = true;
        document.getElementById('lore-editor').hidden = false;
        document.getElementById('lore-editor-footer').hidden = false;
        renderLoreSections();
        document.getElementById('lorebook').scrollTop = 0;
        document.getElementById('lore-entry-name').focus();
      }
      function closeLoreEditor() {
        document.getElementById('lore-list-view').hidden = false;
        document.getElementById('lore-editor').hidden = true;
        document.getElementById('lore-editor-footer').hidden = true;
        document.getElementById('add-lore-entry').focus();
      }
      function moveLoreSection(sourceId, targetId, after = false) {
        if (sourceId === targetId) return;
        const source = loreDraft.sections.find(section => section.id === sourceId);
        if (!source) return;
        const reordered = loreDraft.sections.filter(section => section.id !== sourceId);
        const target = reordered.findIndex(section => section.id === targetId);
        if (target < 0) return;
        reordered.splice(target + Number(after), 0, source);
        loreDraft.sections = reordered;
        renderLoreSections();
        document.getElementById('section-handle-' + sourceId)?.focus();
      }
      function renderLoreSections() {
        const list = document.getElementById('lore-sections');
        list.replaceChildren();
        loreDraft.sections.forEach((section, index) => {
          const card = document.createElement('section'); card.className = 'lore-section';
          const bar = document.createElement('div'); bar.className = 'lore-section-bar';
          const handle = document.createElement('button');
          handle.type = 'button'; handle.className = 'section-handle'; handle.id = 'section-handle-' + section.id;
          handle.textContent = '⠿'; handle.draggable = true;
          handle.title = '드래그하여 순서 변경 · Alt + 위/아래 방향키';
          handle.setAttribute('aria-label', (section.name || '새 섹션') + ' 순서 변경');
          const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'section-toggle';
          toggle.textContent = section.name || '새 섹션';
          toggle.id = 'section-toggle-' + section.id;
          toggle.setAttribute('aria-expanded', String(openLoreSectionId === section.id));
          toggle.setAttribute('aria-controls', 'section-body-' + section.id);
          const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'section-delete';
          remove.textContent = '×'; remove.title = '섹션 삭제'; remove.setAttribute('aria-label', (section.name || '새 섹션') + ' 삭제');
          const body = document.createElement('div'); body.className = 'lore-section-body'; body.id = 'section-body-' + section.id;
          body.hidden = openLoreSectionId !== section.id;
          for (const [key, label, multiline] of [['name', '이름', false], ['description', '설명', true]]) {
            const field = document.createElement('div'); field.className = 'connection-field';
            const caption = document.createElement('label'); caption.htmlFor = 'section-' + key + '-' + section.id; caption.textContent = label;
            const control = document.createElement(multiline ? 'textarea' : 'input'); control.className = 'connection-input'; control.id = caption.htmlFor; control.value = section[key];
            if (!multiline) control.maxLength = 120;
            control.addEventListener('input', () => {
              section[key] = control.value;
              if (key === 'name') {
                toggle.textContent = control.value || '새 섹션';
                handle.setAttribute('aria-label', (control.value || '새 섹션') + ' 순서 변경');
                remove.setAttribute('aria-label', (control.value || '새 섹션') + ' 삭제');
              }
            });
            field.append(caption, control); body.append(field);
          }
          toggle.addEventListener('click', () => {
            openLoreSectionId = openLoreSectionId === section.id ? null : section.id;
            renderLoreSections(); document.getElementById(toggle.id)?.focus();
          });
          remove.addEventListener('click', () => {
            loreDraft.sections = loreDraft.sections.filter(item => item.id !== section.id);
            if (openLoreSectionId === section.id) openLoreSectionId = null;
            renderLoreSections(); document.getElementById('add-lore-section').focus();
          });
          handle.addEventListener('keydown', event => {
            if (!event.altKey || !['ArrowUp','ArrowDown'].includes(event.key)) return;
            const next = index + (event.key === 'ArrowUp' ? -1 : 1);
            event.preventDefault();
            if (loreDraft.sections[next]) moveLoreSection(section.id, loreDraft.sections[next].id, next > index);
          });
          handle.addEventListener('dragstart', event => {
            draggedLoreSectionId = section.id; card.dataset.dragging = 'true';
            event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', section.id);
          });
          handle.addEventListener('dragend', () => {
            draggedLoreSectionId = null;
            document.querySelectorAll('.lore-section').forEach(item => { delete item.dataset.dragging; delete item.dataset.drop; });
          });
          card.addEventListener('dragover', event => {
            if (!draggedLoreSectionId || draggedLoreSectionId === section.id) return;
            event.preventDefault(); event.dataTransfer.dropEffect = 'move'; card.dataset.drop = 'true';
          });
          card.addEventListener('dragleave', event => { if (!card.contains(event.relatedTarget)) delete card.dataset.drop; });
          card.addEventListener('drop', event => {
            if (!draggedLoreSectionId) return;
            event.preventDefault();
            const rect = card.getBoundingClientRect();
            moveLoreSection(draggedLoreSectionId, section.id, event.clientY > rect.top + rect.height / 2);
            draggedLoreSectionId = null;
          });
          bar.append(handle, toggle, remove); card.append(bar, body); list.append(card);
        });
      }
      document.getElementById('add-lore-entry').addEventListener('click', () => openLoreEditor());
      document.getElementById('lore-back').addEventListener('click', closeLoreEditor);
      document.getElementById('lore-entry-type').addEventListener('change', () => refreshLoreEntryFolders());
      document.getElementById('add-lore-section').addEventListener('click', () => {
        const section = { id: crypto.randomUUID(), name: '새 섹션', description: '' };
        loreDraft.sections.push(section); openLoreSectionId = section.id; renderLoreSections();
        document.getElementById('section-name-' + section.id).focus();
      });
      document.getElementById('lore-entry-form').addEventListener('submit', event => {
        event.preventDefault();
        const status = document.getElementById('lore-save-status');
        const name = document.getElementById('lore-entry-name').value.trim();
        if (!name) { status.textContent = '로어북 이름을 입력해 주세요.'; document.getElementById('lore-entry-name').focus(); return; }
        const entry = { ...loreDraft, name, type: document.getElementById('lore-entry-type').value, folderId: document.getElementById('lore-entry-folder').value, description: document.getElementById('lore-entry-description').value, sections: loreDraft.sections.map(section => ({ ...section, name: section.name.trim() || '새 섹션' })) };
        const updated = [...loreEntries.filter(item => item.id !== entry.id), entry];
        try { localStorage.setItem(loreEntryStorageKey, JSON.stringify(updated)); }
        catch { status.textContent = '저장하지 못했어요. 브라우저의 저장 공간을 확인해 주세요.'; return; }
        loreEntries = updated; selectedFolders[entry.type] = entry.folderId;
        refreshWorldLorebooks();
        selectLoreTab(document.getElementById(entry.type)); closeLoreEditor();
      });


      function refreshWorldLorebooks() {
        for (const [id, type, label] of [['world-protagonist', 'lore-protagonist-tab', '주인공'], ['world-background', 'lore-world-tab', '배경']]) {
          const select = document.getElementById(id);
          const selected = select.value;
          const entries = loreEntries.filter(entry => entry.type === type);
          select.replaceChildren(new Option(entries.length ? label + ' 로어북을 선택하세요' : '저장된 ' + label + ' 로어북이 없어요', ''));
          entries.forEach(entry => select.add(new Option(entry.name, entry.id)));
          select.disabled = entries.length === 0;
          if (entries.some(entry => entry.id === selected)) select.value = selected;
        }
        const container = document.getElementById('world-character-lorebooks');
        const checked = new Set(Array.from(container.querySelectorAll('input:checked'), input => input.value));
        container.replaceChildren();
        const entries = loreEntries.filter(entry => entry.type === 'lore-character-tab');
        if (!entries.length) {
          const hint = document.createElement('p'); hint.className = 'connection-field-hint';
          hint.textContent = '저장된 등장인물 로어북이 없어요. 선택 없이 진행하면 AI가 다른 설정과 지침을 참고해 등장인물을 만들어요.';
          container.append(hint);
        }
        entries.forEach(entry => {
          const label = document.createElement('label'); label.className = 'world-check world-lore-choice';
          const input = document.createElement('input'); input.type = 'checkbox'; input.name = 'character-lorebooks'; input.value = entry.id; input.checked = checked.has(entry.id);
          input.setAttribute('aria-label', entry.name);
          const text = document.createElement('span'); text.append(document.createTextNode(entry.name));
          if (entry.description) { const description = document.createElement('small'); description.textContent = entry.description; text.append(description); }
          label.append(input, text); container.append(label);
        });
      }
      // 실제 세계 생성 연결 시 이 선택 결과의 섹션 정보를 AI 요청에 사용합니다.
      function readWorldLorebooks() {
        const selected = (id, type) => loreEntries.find(entry => entry.id === document.getElementById(id).value && entry.type === type) || null;
        const characters = new Set(Array.from(document.querySelectorAll('#world-character-lorebooks input:checked'), input => input.value));
        return structuredClone({
          protagonist: selected('world-protagonist', 'lore-protagonist-tab'),
          background: selected('world-background', 'lore-world-tab'),
          characters: loreEntries.filter(entry => entry.type === 'lore-character-tab' && characters.has(entry.id)),
        });
      }
      refreshWorldLorebooks();
      const energyMaximum = 50;
      const energyIntervalMs = 3 * 60 * 1000;
      const energyStorageKey = 'gacha-game.energy.'+live.id;
      let gameEnergy=live.energy;
      // Energy is restored from the active world in IndexedDB.
      function advanceGameEnergy(state, now) {
        if (state.amount >= energyMaximum) return { amount: energyMaximum, nextAt: null };
        if (now < state.nextAt) return state;
        const gained = Math.floor((now - state.nextAt) / energyIntervalMs) + 1;
        const amount = Math.min(energyMaximum, state.amount + gained);
        return { amount, nextAt: amount === energyMaximum ? null : state.nextAt + gained * energyIntervalMs };
      }
      function updateGameEnergy() {
        const now = Date.now();
        const updated = advanceGameEnergy(gameEnergy, now);
        if (updated.amount !== gameEnergy.amount || updated.nextAt !== gameEnergy.nextAt) {
          try { localStorage.setItem(energyStorageKey, JSON.stringify(updated)); } catch { /* 현재 세션에서 회복을 계속합니다. */ }
        }
        gameEnergy = updated;
        document.getElementById('game-energy-value').textContent = gameEnergy.amount + ' / ' + energyMaximum;
        document.getElementById('game-energy').setAttribute('aria-label', '에너지 ' + gameEnergy.amount + ' / ' + energyMaximum);
        const seconds = Math.max(0, Math.ceil((gameEnergy.nextAt - now) / 1000));
        document.getElementById('energy-tooltip').textContent = gameEnergy.amount === energyMaximum ? '에너지 가득 참' : '다음 에너지 +1까지 ' + String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
      }
      updateGameEnergy();
      setInterval(updateGameEnergy, 1000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) updateGameEnergy(); });
      function original_showGameView(view) {
        hideEquipmentOverlays();
        closePartyFormationMenu();
        if (view !== 'party' && document.getElementById('party-delete-dialog').open) document.getElementById('party-delete-dialog').close();
        const isParty = view === 'party';
        if (view !== 'combat-preview') stopCombatPreview();
        if (view !== 'party' && view !== 'combat-preview') { battleStageContext = null; closeBattleBriefing(); }
        const isInventory = view === 'inventory';
        const isSummon = view === 'summon';
        const isMaterials = view === 'materials';
        const isMaterialDungeon = view === 'material-dungeon';
        if (!isSummon && document.getElementById('summon-dialog').open) document.getElementById('summon-dialog').close();
        const isEquipmentPicker = view === 'equipment-picker';
        const isEquipmentEnhancement = view === 'equipment-enhancement';
        const isCharacterDetail = view === 'character-detail';
        const isCharacters = view === 'characters';
        if (isCharacters) {
          Array.from(document.querySelectorAll('.character-portrait-card')).forEach((card, index) => {
            card.style.setProperty('--character-enter-delay', 100 + index * 100 + 'ms');
          });
        }
        const isCombatPreview = view === 'combat-preview';
        const isStoryPreview = view === 'story-preview';
        const isBattle = view === 'battle';
        const isScenarios = view === 'scenarios';
        const isChapters = view === 'chapters';
        if (isScenarios) updateScenarioVisibility();
        if (isChapters || isScenarios) {
          const selector = isChapters ? '.chapter-list .chapter-card' : '.scenario-list .scenario-card';
          Array.from(document.querySelectorAll(selector)).filter(card => !card.hidden).forEach((card, index) => {
            card.style.setProperty('--card-enter-delay', 100 + index * 100 + 'ms');
          });
        }
        const isSubscreen = isMaterials || isMaterialDungeon || isSummon || isInventory || isParty || isBattle || isScenarios || isChapters || isStoryPreview || isCombatPreview || isCharacters || isCharacterDetail || isEquipmentPicker || isEquipmentEnhancement;
        const game = document.getElementById('game-preview');
        if (game.dataset.view === 'story-preview' && !isStoryPreview) {
          stopDialogueTyping();
          setDialogueAuto(false);
        }
        game.dataset.view = isMaterials ? 'materials' : isMaterialDungeon ? 'material-dungeon' : isSummon ? 'summon' : isInventory ? 'inventory' : isParty ? 'party' : isEquipmentEnhancement ? 'equipment-enhancement' : isEquipmentPicker ? 'equipment-picker' : isCharacterDetail ? 'character-detail' : isCharacters ? 'characters' : isCombatPreview ? 'combat-preview' : isStoryPreview ? 'story-preview' : isChapters ? 'chapters' : isScenarios ? 'scenarios' : isBattle ? 'battle' : 'home';
        game.setAttribute('aria-label', isCharacters ? '캐릭터 화면' : isCombatPreview ? '전투' : isStoryPreview ? '시나리오' : isChapters ? '챕터 목록 화면' : isScenarios ? '시나리오 목록 화면' : isBattle ? '전투 화면' : '게임 메인 화면');
        const menu = document.querySelector('.game-bottom-menu');
        menu.inert = isSubscreen;
        menu.setAttribute('aria-hidden', String(isSubscreen));
        const homeButton = document.getElementById('game-home');
        homeButton.hidden = false;
        homeButton.disabled = !isSubscreen;
        homeButton.setAttribute('aria-hidden', String(!isSubscreen));
        document.getElementById('game-stage').setAttribute('aria-label', isCharacters ? '캐릭터 화면' : isCombatPreview ? '전투 미리보기' : isStoryPreview ? '시나리오 미리보기' : isChapters ? '챕터 목록 화면' : isScenarios ? '시나리오 목록 화면' : isBattle ? '전투 화면' : '메인 화면');
        document.getElementById('characters-screen').hidden = !isCharacters;
        document.getElementById('materials-screen').hidden = !isMaterials;
        document.getElementById('material-dungeon-screen').hidden = !isMaterialDungeon;
        if (isMaterials || isMaterialDungeon) {
          game.setAttribute('aria-label', isMaterials ? '재료 던전 목록' : '재료 던전 층 선택');
          document.getElementById('game-stage').setAttribute('aria-label', isMaterials ? '재료 던전 목록' : '재료 던전 층 선택');
          refreshDungeonSchedule();
          if (isMaterials) renderMaterialDungeons(); else renderMaterialDungeon();
        }
        document.getElementById('inventory-screen').hidden = !isInventory;
        document.getElementById('summon-screen').hidden = !isSummon;
        if (isSummon) {
          game.setAttribute('aria-label', '소환 화면');
          document.getElementById('game-stage').setAttribute('aria-label', '소환 화면');
          renderSummon();
        }
        if (isInventory) {
          game.setAttribute('aria-label', '인벤토리 화면');
          document.getElementById('game-stage').setAttribute('aria-label', '인벤토리 화면');
          renderInventory();
        }
        document.getElementById('party-screen').hidden = !isParty;
        if (isParty) {
          game.setAttribute('aria-label', '편성 화면');
          document.getElementById('game-stage').setAttribute('aria-label', '편성 화면');
          renderParty();
        }
        document.getElementById('character-detail-screen').hidden = !isCharacterDetail;
        document.getElementById('equipment-picker-screen').hidden = !isEquipmentPicker;
        document.getElementById('equipment-enhancement-screen').hidden = !isEquipmentEnhancement;
        if (isEquipmentEnhancement) {
          game.setAttribute('aria-label', '장비 강화 화면');
          document.getElementById('game-stage').setAttribute('aria-label', '장비 강화 화면');
        }
        if (isEquipmentPicker) {
          game.setAttribute('aria-label', '장비 선택 화면');
          document.getElementById('game-stage').setAttribute('aria-label', '장비 선택 화면');
        }
        if (isCharacterDetail) {
          game.setAttribute('aria-label', '캐릭터 상세 화면');
          document.getElementById('game-stage').setAttribute('aria-label', '캐릭터 상세 화면');
        }
        document.getElementById('combat-preview-screen').hidden = !isCombatPreview;
        document.getElementById('story-preview-screen').hidden = !isStoryPreview;
        document.getElementById('battle-content').hidden = !isBattle;
        document.getElementById('scenario-screen').hidden = !isScenarios;
        document.getElementById('chapter-screen').hidden = !isChapters;
      }
      document.getElementById('game-battle').addEventListener('click', () => {
        showGameView('battle');
        document.getElementById('game-home').focus({ preventScroll: true });
      });
      document.getElementById('game-home').addEventListener('click', () => {
        const fromSummon = document.getElementById('game-preview').dataset.view === 'summon';
        const fromInventory = document.getElementById('game-preview').dataset.view === 'inventory';
        const fromParty = document.getElementById('game-preview').dataset.view === 'party';
        const fromCharacters = ['characters', 'character-detail', 'equipment-picker', 'equipment-enhancement'].includes(document.getElementById('game-preview').dataset.view);
        showGameView('home');
        document.getElementById(fromSummon ? 'game-summon' : fromInventory ? 'game-inventory' : fromParty ? 'game-party' : fromCharacters ? 'game-characters' : 'game-battle').focus({ preventScroll: true });
      });
      document.getElementById('story-entry-card').addEventListener('click', () => {
        showGameView('chapters');
        document.getElementById('chapter-screen').scrollTop = 0;
        document.getElementById('chapter-back').focus({ preventScroll: true });
      });
      document.getElementById('scenario-back').addEventListener('click', () => {
        showGameView('chapters');
        document.getElementById('chapter-card-' + selectedPreviewChapter)?.focus({ preventScroll: true });
      });
      document.getElementById('chapter-back').addEventListener('click', () => {
        showGameView('battle');
        document.getElementById('story-entry-card').focus({ preventScroll: true });
      });
      function updateScenarioVisibility() {
        const cards = Array.from(document.querySelectorAll('.scenario-list .scenario-card'));
        const newestIndex = cards.findIndex(card => card.dataset.state === 'new');
        const nextLockedIndex = newestIndex >= 0 ? newestIndex + 1 : cards.findIndex(card => card.dataset.state === 'locked');
        cards.forEach((card, index) => {
          const locked = card.dataset.state === 'locked';
          card.hidden = locked && index !== nextLockedIndex;
          if (locked) {
            const info = card.querySelector('.scenario-info');
            const name = document.createElement('span'); name.className = 'scenario-name'; name.textContent = '미발견 시나리오';
            const description = document.createElement('span'); description.className = 'scenario-description'; description.textContent = '아직 발견되지 않은 시나리오입니다.';
            info.replaceChildren(name, description);
          }
        });
      }
      // 실제 생성·진행 데이터가 연결되기 전까지 상태 확인용 챕터를 표시합니다.
      const previewChapters=live.chapters;
      const scenarioTemplate=document.createElement('button');scenarioTemplate.type='button';scenarioTemplate.className='scenario-card';scenarioTemplate.innerHTML='<span class="scenario-number"></span><span class="scenario-info"><span class="scenario-name"></span><span class="scenario-description"></span></span><span class="scenario-status"></span>';const previewScenarioTemplates=[scenarioTemplate];
      for (const chapter of previewChapters) chapter.completedIndices = Array.from({ length: chapter.completed }, (_, index) => index);
      let selectedPreviewChapter = null;
      function openPreviewChapter(chapter) {
        if (chapter.state === 'locked') return;
        selectedPreviewChapter = chapter.id;
        const list = document.querySelector('.scenario-list');
        list.replaceChildren();
        for (let index = 0; index < 10; index++) {
          const card = previewScenarioTemplates[Math.min(index, previewScenarioTemplates.length - 1)].cloneNode(true);
          const nextIndex = Array.from({ length: 10 }, (_, i) => i).find(i => !chapter.completedIndices.includes(i));
          const state = chapter.completedIndices.includes(index) ? 'completed' : index === nextIndex ? 'new' : 'locked';
          card.dataset.state = state;
          // 화면 확인 단계에서는 잠긴 시나리오도 동일한 미리보기를 엽니다.
          card.disabled=state==='locked';card.hidden=false;
          card.querySelector('.scenario-number').textContent = String(index + 1).padStart(2, '0');
          const info = card.querySelector('.scenario-info');
          if (state !== 'locked') {
            const name = document.createElement('span'); name.className = 'scenario-name'; name.textContent = chapter.episodes[index].title;
            const description = document.createElement('span'); description.className = 'scenario-description'; description.textContent = chapter.episodes[index].goal;
            info.replaceChildren(name, description);
          }
          card.querySelector('.scenario-status').textContent = state === 'completed' ? '✓ 클리어' : state === 'new' ? 'NEW · 새로 열림' : '잠김';
          list.append(card);
        }
        document.getElementById('scenario-chapter-title').textContent = '챕터 ' + chapter.id + ' · ' + chapter.name;
        showGameView('scenarios');
        document.getElementById('scenario-screen').scrollTop = 0;
        document.getElementById('scenario-back').focus({ preventScroll: true });
      }
      function renderPreviewChapters() {
      document.getElementById('chapter-list').replaceChildren();
      for (const chapter of previewChapters) {
        const card = document.createElement('button'); card.type = 'button'; card.className = 'scenario-card chapter-card';
        card.id = 'chapter-card-' + chapter.id; card.dataset.state = chapter.state; card.disabled = chapter.state === 'locked';
        const number = document.createElement('span'); number.className = 'scenario-number'; number.textContent = String(chapter.id).padStart(2, '0');
        const info = document.createElement('span'); info.className = 'scenario-info';
        const name = document.createElement('span'); name.className = 'scenario-name'; name.textContent = chapter.name;
        const description = document.createElement('span'); description.className = 'scenario-description'; description.textContent = chapter.description;
        const progress = document.createElement('span'); progress.className = 'chapter-progress';
        const count = document.createElement('span'); count.className = 'chapter-progress-label'; count.textContent = '진행도 ' + chapter.completed + '/10';
        const bar = document.createElement('progress'); bar.max = 10; bar.value = chapter.completed;
        bar.setAttribute('aria-label', '챕터 ' + chapter.id + ' 진행도'); bar.setAttribute('aria-valuetext', chapter.completed + '/10');
        progress.append(count, bar); info.append(name, description, progress);
        const status = document.createElement('span'); status.className = 'scenario-status'; status.textContent = chapter.state === 'completed' ? '✓ 클리어' : chapter.state === 'new' ? 'NEW · 새로 열림' : '잠김';
        card.append(number, info, status); card.addEventListener('click', () => openPreviewChapter(chapter));
        document.getElementById('chapter-list').append(card);
      }
      }
      renderPreviewChapters();
      let previewScenarioCard = null;
      document.querySelector('.scenario-list').addEventListener('click', event => {
        const card = event.target.closest('.scenario-card');
        if (!card) return;
        previewScenarioCard = card;
        const chapter = previewChapters.find(item => item.id === selectedPreviewChapter);
        const chapterWords = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
        // 공통 전투 화면을 확인하기 위한 임시 진입 지점입니다.
        if (chapter?.id === '2' && Number(card.querySelector('.scenario-number').textContent) === 3) {
          openBattleStageSetup({ source: 'story', title: card.querySelector('.scenario-name')?.textContent || '전투', subtitle: 'Chapter ' + (chapterWords[Number(chapter.id)] || chapter.id) + ' · ' + chapter.name,
            objective: '모든 적을 처치하고 길을 확보하세요.', description: '앞길을 가로막은 경계 병력이 접근하고 있습니다. 적의 전열과 후열을 확인하고 전투를 준비하세요.', image: 'assets/dungeons/story-entry.png' });
          return;
        }
        document.getElementById('story-preview-title').textContent = card.querySelector('.scenario-name')?.textContent || '시나리오';
        document.getElementById('story-preview-chapter').textContent = chapter ? 'Chapter ' + (chapterWords[Number(chapter.id)] || chapter.id) + ' · ' + chapter.name : '';
        showGameView('story-preview');
        startDialoguePreview();
        document.getElementById('story-preview-back').focus({ preventScroll: true });
      });
      document.getElementById('story-preview-back').addEventListener('click', () => {
        showGameView('scenarios');
        previewScenarioCard?.focus({ preventScroll: true });
      });
      let dialoguePreviewLines=[];
      let dialogueLineIndex = 0;
      let dialogueCharacters = [];
      let dialogueCharacterIndex = 0;
      let dialogueTypingTimer = null;
      let dialogueIsTyping = false;
      let dialogueAutoEnabled = false;
      let dialogueAutoTimer = null;
      let dialogueHistory = [];
      const storyLogDialog = document.getElementById('story-log-dialog');
      function scheduleDialogueAuto() {
        clearTimeout(dialogueAutoTimer);
        dialogueAutoTimer = null;
        if (!dialogueAutoEnabled || dialogueIsTyping || dialogueLineIndex === dialoguePreviewLines.length - 1 || storyLogDialog.open || document.hidden || document.getElementById('game-preview').dataset.view !== 'story-preview') return;
        dialogueAutoTimer = setTimeout(() => {
          dialogueAutoTimer = null;
          if (dialogueAutoEnabled && !dialogueIsTyping && dialogueLineIndex < dialoguePreviewLines.length - 1 && !storyLogDialog.open) advanceDialogue();
        }, 2000);
      }
      function setDialogueAuto(enabled) {
        dialogueAutoEnabled = enabled;
        document.getElementById('story-auto').setAttribute('aria-pressed', String(enabled));
        scheduleDialogueAuto();
      }
      function stopDialogueTyping() {
        clearTimeout(dialogueAutoTimer);
        dialogueAutoTimer = null;
        clearInterval(dialogueTypingTimer);
        dialogueTypingTimer = null;
        dialogueIsTyping = false;
      }
      function finishDialogueLine() {
        stopDialogueTyping();
        document.getElementById('story-dialogue-text').textContent = dialogueCharacters.join('');
        const isLast = dialogueLineIndex === dialoguePreviewLines.length - 1;
        document.getElementById('story-dialogue-next').hidden = isLast;
        document.getElementById('story-dialogue-complete').hidden = !isLast;
        dialogueHistory[dialogueLineIndex] = { speaker: document.getElementById('story-dialogue-speaker').textContent, text: dialogueCharacters.join('') };
        scheduleDialogueAuto();
      }
      function typeDialogueLine() {
        stopDialogueTyping();
        const text = dialoguePreviewLines[dialogueLineIndex];const line=activeStory?.scenes[dialogueLineIndex];document.getElementById('story-dialogue-speaker').textContent=line?.speakerId?(live.catalog.find(c=>c.id===line.speakerId)?.name||'내레이션'):'내레이션';
        dialogueCharacters = typeof Intl.Segmenter === 'function'
          ? Array.from(new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(text), part => part.segment)
          : Array.from(text);
        dialogueCharacterIndex = 0;
        const body = document.getElementById('story-dialogue-text');
        body.textContent = '';
        document.getElementById('story-dialogue-next').hidden = true;
        document.getElementById('story-dialogue-complete').hidden = true;
        document.getElementById('story-dialogue-box').scrollTop = 0;
        dialogueIsTyping = true;
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) { finishDialogueLine(); return; }
        dialogueTypingTimer = setInterval(() => {
          dialogueCharacterIndex++;
          body.textContent = dialogueCharacters.slice(0, dialogueCharacterIndex).join('');
          if (dialogueCharacterIndex >= dialogueCharacters.length) finishDialogueLine();
        }, 40);
      }
      function startDialoguePreview() {
        setDialogueAuto(false);
        dialogueHistory = [];
        dialogueLineIndex = 0;
        typeDialogueLine();
      }
      function advanceDialogue() {
        clearTimeout(dialogueAutoTimer);
        dialogueAutoTimer = null;
        if (dialogueIsTyping) { finishDialogueLine(); return; }
        if (dialogueLineIndex < dialoguePreviewLines.length - 1) {
          dialogueLineIndex++;
          typeDialogueLine();
        }
      }
      document.getElementById('story-dialogue-box').addEventListener('click', advanceDialogue);
      document.getElementById('story-dialogue-box').addEventListener('keydown', event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (!event.repeat) advanceDialogue();
        }
      });
      document.getElementById('story-auto').addEventListener('click', () => setDialogueAuto(!dialogueAutoEnabled));
      document.getElementById('story-log').addEventListener('click', () => {
        clearTimeout(dialogueAutoTimer);
        dialogueAutoTimer = null;
        const entries = dialogueHistory.filter(Boolean).map(entry => ({ ...entry }));
        if (dialogueIsTyping) {
          const text = document.getElementById('story-dialogue-text').textContent;
          if (text) entries.push({ speaker: document.getElementById('story-dialogue-speaker').textContent, text });
        }
        const list = document.getElementById('story-log-list');
        list.replaceChildren();
        if (!entries.length) { const empty = document.createElement('p'); empty.textContent = '아직 표시된 내용이 없어요.'; list.append(empty); }
        let previousSpeaker = null;
        let group = null;
        entries.forEach(entry => {
          if (!group || previousSpeaker !== entry.speaker) {
            group = document.createElement('div'); group.className = 'story-log-entry';
            const speaker = document.createElement('strong'); speaker.textContent = entry.speaker;
            group.append(speaker); list.append(group); previousSpeaker = entry.speaker;
          }
          const text = document.createElement('p'); text.textContent = entry.text;
          group.append(text);
        });
        resizeStoryLog();
        storyLogDialog.showModal();
        list.scrollTop = list.scrollHeight;
        document.getElementById('story-log-close').focus();
      });
      document.getElementById('story-log-close').addEventListener('click', () => storyLogDialog.close());
      storyLogDialog.addEventListener('close', scheduleDialogueAuto);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { clearTimeout(dialogueAutoTimer); dialogueAutoTimer = null; }
        else scheduleDialogueAuto();
      });
      function resizeStoryLog() {
        const frame = document.querySelector('.game-frame').getBoundingClientRect();
        storyLogDialog.style.width = frame.width * .8 + 'px';
        storyLogDialog.style.height = frame.height * .8 + 'px';
      }
      window.addEventListener('resize', () => { if (storyLogDialog.open) resizeStoryLog(); });
      document.getElementById('story-dialogue-complete').addEventListener('click', event => {
        event.stopPropagation();
        if (dialogueIsTyping || dialogueLineIndex !== dialoguePreviewLines.length - 1) return;
        const chapter = previewChapters.find(item => item.id === selectedPreviewChapter);
        const index = Number(previewScenarioCard?.querySelector('.scenario-number').textContent) - 1;
        if (!chapter || !Number.isInteger(index) || index < 0 || index >= 10) return;
        if (!chapter.completedIndices.includes(index)) chapter.completedIndices.push(index);
        chapter.completed = chapter.completedIndices.length;
        chapter.state = chapter.completed === 10 ? 'completed' : 'new';
        if (chapter.completed === 10) {
          const next = previewChapters[previewChapters.indexOf(chapter) + 1];
          if (next?.state === 'locked') next.state = 'new';
        }
        renderPreviewChapters();
        openPreviewChapter(chapter);
      });
      document.getElementById('combat-preview-back').addEventListener('click', () => {
        stopCombatPreview();
        if (battleStageContext) { returnToBattleSetup(); return; }
        showGameView('scenarios'); previewScenarioCard?.focus({ preventScroll: true });
      });
      document.getElementById('combat-auto').addEventListener('click', event => {
        const button = event.currentTarget;
        button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
        scheduleCombatPreview();
      });
      document.getElementById('combat-speed').addEventListener('click', event => {
        const screen = document.getElementById('combat-preview-screen');
        const speed = Number(screen.dataset.speed || 1) % 3 + 1;
        screen.dataset.speed = String(speed);
        event.currentTarget.textContent = 'x' + speed;
        event.currentTarget.setAttribute('aria-label', '전투 배속 x' + speed);
        scheduleCombatPreview();
      });
      // 화면/조작 확인용 상태입니다. 실제 체력·재화·캐릭터 데이터는 변경하지 않습니다.
      let combatPreviewState = null;
      let combatPreviewTimer = null;
      let combatOverlayTimer = null;
      let battleStageContext = null;
      let battleBriefingOpen = false;
      const combatPreviewSkills = [
        { id: 'basic', name: '기본 스킬', title: '집중 공격', description: '선택한 적 하나를 공격합니다.', condition: '쿨타임 없음', path: 'm5 19 14-14M13 5h6v6M4 14l6 6' },
        { id: 'active', name: '액티브', title: '돌파의 일격', description: '선택한 적에게 강력한 일격을 가합니다.', condition: '쿨타임 3턴 · 미리보기', path: 'm13 2-8 12h6l-1 8 9-13h-7l1-7Z' },
        { id: 'ultimate', name: '궁극기', title: '여명의 파동', description: '모든 적을 향해 힘을 방출합니다.', condition: '에너지 100% 필요', path: 'm12 2 3 6 7 4-7 3-3 7-3-7-7-3 7-4 3-6Z' },
        { id: 'passive', name: '패시브', title: '흔들리지 않는 의지', description: '전투 중 유지되는 고유 효과입니다. 직접 사용하는 스킬이 아닙니다.', condition: '상시 효과 · 미리보기', path: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6' },
      ];
      function stopCombatPreview() {
        clearTimeout(combatPreviewTimer); combatPreviewTimer = null;
        clearTimeout(combatOverlayTimer); combatOverlayTimer = null;
        document.getElementById('combat-skill-tooltip').hidden = true;
        document.getElementById('combat-ultimate').hidden = true;
      }
      function original_resetCombatPreview() {
        stopCombatPreview();
        const roster = Array.from(document.querySelectorAll('#characters-screen .character-portrait-card'));
        const allies = Array.from({ length: 6 }, (_, index) => {
          const card = battleStageContext ? previewParty[index] : previewParty[index] || roster[index] || null;
          const info = card ? getCharacterEquipmentTotalStats(card) : { speed: 100 - index, hp: 2400 };
          const empty = Boolean(battleStageContext && !card);
          return { id: 'ally-' + index, team: 'ally', slot: index, empty, name: empty ? '미편성' : card?.querySelector('.character-card-name')?.textContent || '아군 ' + (index + 1), image: card?.querySelector('img')?.getAttribute('src') || '', speed: info.speed, hp: empty ? 0 : info.hp, energy: empty ? 0 : 100, cooldown: 0 };
        });
        const enemies = Array.from({ length: 6 }, (_, index) => ({ id: 'enemy-' + index, team: 'enemy', slot: index, name: battleStageContext ? ['선봉 수호체', '추격 수호체', '포격 수호체'][Math.floor(index / 2)] + ' ' + (index % 2 + 1) : '적군 ' + (index + 1), image: '', speed: 94 - index * 3, hp: 2800, energy: 0, cooldown: 0 }));
        const units = [...allies, ...enemies];
        combatPreviewState = { units, queue: units.filter(unit => !unit.empty).sort((a, b) => b.speed - a.speed || a.id.localeCompare(b.id)), selectedSkill: null, busy: false };
        renderCombatPreview();
      }
      function isCombatPreviewSkillAvailable(skill, unit) {
        return unit?.team === 'ally' && skill.id !== 'passive' && (skill.id !== 'active' || unit.cooldown === 0) && (skill.id !== 'ultimate' || unit.energy >= 100);
      }
      function original_renderCombatPreview() {
        if (!combatPreviewState) return;
        const { units, queue, selectedSkill } = combatPreviewState, current = queue[0];
        const turns = document.getElementById('combat-turn-list'); turns.replaceChildren();
        queue.slice(0, 7).forEach((unit, index) => {
          const entry = document.createElement('div'); entry.className = 'combat-turn'; entry.dataset.team = unit.team; entry.dataset.current = String(index === 0); entry.setAttribute('role', 'listitem');
          entry.setAttribute('aria-label', (index === 0 ? '현재 턴 · ' : '') + unit.name);
          if (index === 0) entry.setAttribute('aria-current', 'true');
          if (unit.image) {
            const image = document.createElement('img'); image.src = unit.image; image.alt = ''; entry.append(image);
          } else {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 100 140'); svg.setAttribute('fill', 'currentColor'); svg.setAttribute('aria-hidden', 'true');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M50 12a20 20 0 1 0 0 40 20 20 0 0 0 0-40M14 132l6-55c2-18 58-18 60 0l6 55Z'); svg.append(path); entry.append(svg);
          }
          turns.append(entry);
        });
        turns.scrollLeft = 0;
        for (const team of ['enemy', 'ally']) {
          const list = document.getElementById(team === 'enemy' ? 'combat-enemies' : 'combat-allies'); list.replaceChildren();
          const teamUnits = units.filter(unit => unit.team === team);
          const ordered = teamUnits;
          ordered.forEach(unit => {
            const slot = document.createElement('li'); slot.dataset.row = unit.slot < 3 ? '전열' : '후열';
            const card = document.createElement('button'); card.type = 'button'; card.className = 'combat-unit'; card.dataset.team = team; card.dataset.current = String(unit === current);
            card.dataset.empty = String(Boolean(unit.empty)); card.disabled=Boolean(unit.empty||unit.hp<=0||combatPreviewState.result);card.dataset.dead=String(unit.hp<=0);
            card.dataset.target = String(team === 'enemy' && Boolean(selectedSkill));
            card.setAttribute('aria-label', unit.name + ' · 체력 ' + unit.hp + ' · 에너지 ' + unit.energy + '%' + (card.dataset.target === 'true' ? ' · 스킬 대상 선택' : ''));
            if (unit === current) card.setAttribute('aria-current', 'true');
            if (unit.image) { const image = document.createElement('img'); image.className = 'combat-unit-art'; image.src = unit.image; image.alt = ''; card.append(image); }
            else {
              const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 100 140'); svg.setAttribute('fill', 'currentColor'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'combat-unit-silhouette');
              const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M50 12a20 20 0 1 0 0 40 20 20 0 0 0 0-40M14 132l6-55c2-18 58-18 60 0l6 55Z'); svg.append(path); card.append(svg);
            }
            const name = document.createElement('strong'); name.className = 'combat-unit-name'; name.textContent = unit.name;
            const health = document.createElement('span'); health.className = 'combat-unit-health'; const healthFill = document.createElement('i'); healthFill.style.width = (unit.maxHp?Math.max(0,unit.hp/unit.maxHp)*100:0)+'%'; health.append(healthFill);
            const energy = document.createElement('span'); energy.className = 'combat-unit-energy'; const energyFill = document.createElement('i'); energyFill.style.width = unit.energy + '%'; energy.append(energyFill);
            card.append(name, health, energy);
            card.addEventListener('click', () => { if (team === 'enemy' && combatPreviewState.selectedSkill) playCombatPreviewAction(combatPreviewState.selectedSkill, unit); });
            slot.append(card); list.append(slot);
          });
        }
        document.getElementById('combat-action-hint').textContent = current.team === 'enemy' ? '적군 행동 미리보기' : selectedSkill ? '대상 카드를 선택하세요.' : '사용할 스킬을 선택하세요.';
        const skills = document.getElementById('combat-skill-grid'); skills.replaceChildren();
        combatPreviewSkills.forEach(skill => {
          const available = isCombatPreviewSkillAvailable(skill, current);
          const button = document.createElement('button'); button.type = 'button'; button.className = 'combat-skill'; button.dataset.skill = skill.id; button.dataset.unavailable = String(!available); button.setAttribute('aria-pressed', String(selectedSkill === skill.id)); button.setAttribute('aria-label', skill.title + ' · ' + skill.name); button.setAttribute('aria-disabled', String(!available));
          const disc = document.createElement('span'); disc.className = 'combat-skill-disc';
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.5'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', skill.path); svg.append(path); disc.append(svg);
          if (skill.id === 'active' || skill.id === 'ultimate') { const value = document.createElement('span'); value.className = 'combat-skill-value'; value.textContent = skill.id === 'ultimate' ? current.energy + '%' : current.cooldown + '턴'; disc.append(value); }
          const label = document.createElement('span'); label.textContent = skill.name; button.append(disc, label);
          const showDescription = () => {
            const tooltip = document.getElementById('combat-skill-tooltip'); tooltip.replaceChildren();
            const title = document.createElement('strong'); title.textContent = skill.title;
            const description = document.createElement('p'); description.textContent = skill.description;
            const condition = document.createElement('small'); condition.textContent = skill.id === 'active' && current.cooldown ? '남은 쿨타임 ' + current.cooldown + '턴' : skill.condition;
            tooltip.append(title, description, condition); tooltip.hidden = false; button.setAttribute('aria-describedby', 'combat-skill-tooltip');
          };
          const hideDescription = () => { document.getElementById('combat-skill-tooltip').hidden = true; button.removeAttribute('aria-describedby'); };
          button.addEventListener('pointerenter', showDescription); button.addEventListener('focus', showDescription); button.addEventListener('pointerleave', hideDescription); button.addEventListener('blur', hideDescription);
          button.addEventListener('click', () => {
            if (combatPreviewState.busy) return;
            if (!available) { showDescription(); return; }
            document.getElementById('combat-auto').setAttribute('aria-pressed', 'false'); clearTimeout(combatPreviewTimer);
            combatPreviewState.selectedSkill = selectedSkill === skill.id ? null : skill.id; hideDescription(); renderCombatPreview();
          });
          skills.append(button);
        });
      }
      function original_playCombatPreviewAction(skillId, target) {
        if (!combatPreviewState || combatPreviewState.busy || battleBriefingOpen || document.getElementById('game-preview').dataset.view !== 'combat-preview') return;
        const current = combatPreviewState.queue[0], skill = combatPreviewSkills.find(skill => skill.id === skillId);
        if (!skill || !target || target.team !== 'enemy' || !isCombatPreviewSkillAvailable(skill, current)) return;
        combatPreviewState.busy = true;
        document.getElementById('combat-skill-tooltip').hidden = true;
        document.getElementById('combat-action-hint').textContent = skill.title + ' · ' + (skillId === 'ultimate' ? '적 전체' : target.name);
        if (skillId === 'active') current.cooldown = 3;
        if (skillId === 'ultimate') {
          current.energy = 0;
          const overlay = document.getElementById('combat-ultimate'); overlay.replaceChildren();
          const actor = document.createElement('small'); actor.textContent = current.name;
          const title = document.createElement('strong'); title.textContent = skill.title;
          const effect = document.createElement('p'); effect.textContent = skill.description; overlay.append(actor, title, effect); overlay.hidden = false;
          clearTimeout(combatOverlayTimer); combatOverlayTimer = setTimeout(() => { overlay.hidden = true; }, 1000);
        } else current.energy = Math.min(100, current.energy + 20);
        clearTimeout(combatPreviewTimer);
        combatPreviewTimer = setTimeout(advanceCombatPreviewTurn, skillId === 'ultimate' ? 1100 : 600 / Number(document.getElementById('combat-preview-screen').dataset.speed || 1));
      }
      function original_advanceCombatPreviewTurn() {
        if (!combatPreviewState || document.getElementById('game-preview').dataset.view !== 'combat-preview') return;
        const state = combatPreviewState; state.queue.push(state.queue.shift()); state.selectedSkill = null; state.busy = false;
        state.queue[0].cooldown = Math.max(0, state.queue[0].cooldown - 1);
        renderCombatPreview(); scheduleCombatPreview();
      }
      function original_scheduleCombatPreview() {
        if (!combatPreviewState || combatPreviewState.busy || battleBriefingOpen) return;
        clearTimeout(combatPreviewTimer);
        if (document.hidden || document.getElementById('game-preview').dataset.view !== 'combat-preview') return;
        const current = combatPreviewState.queue[0];
        if (current.team === 'ally' && document.getElementById('combat-auto').getAttribute('aria-pressed') !== 'true') return;
        combatPreviewTimer = setTimeout(() => {
          if (current.team === 'enemy') { advanceCombatPreviewTurn(); return; }
          const skill = current.energy >= 100 ? 'ultimate' : current.cooldown === 0 ? 'active' : 'basic';
          playCombatPreviewAction(skill, combatPreviewState.units.find(unit => unit.team === 'enemy' && unit.slot < 3));
        }, 1000 / Number(document.getElementById('combat-preview-screen').dataset.speed || 1));
      }
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { clearTimeout(combatPreviewTimer); if (combatPreviewState?.busy) { combatPreviewState.busy = false; advanceCombatPreviewTurn(); } }
        else scheduleCombatPreview();
      });
      document.getElementById('combat-preview-screen').addEventListener('keydown', event => {
        if (event.key === 'Escape' && combatPreviewState && !battleBriefingOpen) { combatPreviewState.selectedSkill = null; document.getElementById('combat-skill-tooltip').hidden = true; renderCombatPreview(); }
      });
      function renderBattleSetupControls() {
        const active = Boolean(battleStageContext);
        const button = document.getElementById('party-stage-enter');
        button.hidden = !active;
        button.disabled = !previewParty.some(Boolean);
      }
      function openBattleStageSetup(context) {
        stopCombatPreview(); closeBattleBriefing();
        battleStageContext = { ...context };
        showGameView('party');
        document.getElementById('party-title').focus({ preventScroll: true });
      }
      function closeBattleBriefing() {
        battleBriefingOpen = false;
        document.getElementById('battle-briefing').hidden = true;
        document.querySelectorAll('#combat-preview-screen > .combat-arena, #combat-preview-screen > .story-preview-top').forEach(element => { element.inert = false; });
      }
      function returnToBattleSetup() {
        stopCombatPreview(); closeBattleBriefing();
        showGameView('party');
        document.getElementById('party-stage-enter').focus({ preventScroll: true });
      }
      function showBattleBriefing() {
        if (!battleStageContext || !previewParty.some(Boolean)) return;
        const context = battleStageContext;
        document.getElementById('combat-preview-title').textContent = context.title;
        document.getElementById('combat-preview-chapter').textContent = context.subtitle;
        document.getElementById('combat-auto').setAttribute('aria-pressed', 'false');
        const screen = document.getElementById('combat-preview-screen'); screen.dataset.speed = '1';
        screen.style.setProperty('--combat-background-image', 'url("' + context.image + '")');
        document.getElementById('combat-speed').textContent = 'x1';
        document.getElementById('combat-speed').setAttribute('aria-label', '전투 배속 x1');
        showGameView('combat-preview'); resetCombatPreview();
        document.getElementById('battle-briefing-objective').textContent = context.objective;
        document.getElementById('battle-briefing-description').textContent = context.description;
        document.getElementById('battle-briefing-stage').textContent = context.title + ' · ' + context.subtitle;
        const enemies = [
          { name: '선봉 수호체', description: '전열에서 아군의 공격을 받아내는 적입니다. 기본 공격으로 대상을 압박합니다.', path: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z' },
          { name: '추격 수호체', description: '빠른 공격으로 한 대상을 노립니다. 행동 순서를 확인해 먼저 대응하세요.', path: 'm5 19 14-14M13 5h6v6M4 14l6 6' },
          { name: '포격 수호체', description: '후열에서 에너지를 모아 광역 공격을 준비하는 적입니다.', path: 'm13 2-8 12h6l-1 8 9-13h-7l1-7Z' },
        ];
        const list = document.getElementById('battle-briefing-enemies'); list.replaceChildren();
        const label = document.createElement('span'); label.textContent = '등장 적'; list.append(label);
        const details = document.getElementById('battle-enemy-description'); details.textContent = '적 아이콘을 선택하면 전투 방식을 확인할 수 있습니다.';
        enemies.forEach(enemy => {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'battle-enemy-info'; button.setAttribute('aria-label', enemy.name); button.setAttribute('aria-pressed', 'false');
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.4'); svg.setAttribute('aria-hidden', 'true');
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', enemy.path); svg.append(path); button.append(svg);
          const describe = () => { const title = document.createElement('strong'); title.textContent = enemy.name + ' · '; details.replaceChildren(title, document.createTextNode(enemy.description)); list.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button))); };
          button.addEventListener('pointerenter', describe); button.addEventListener('focus', describe); button.addEventListener('click', describe); list.append(button);
        });
        battleBriefingOpen = true;
        document.querySelectorAll('#combat-preview-screen > .combat-arena, #combat-preview-screen > .story-preview-top').forEach(element => { element.inert = true; });
        document.getElementById('battle-briefing').hidden = false;
        document.getElementById('battle-briefing-start').focus({ preventScroll: true });
      }
      document.getElementById('party-stage-enter').addEventListener('click', showBattleBriefing);
      document.getElementById('battle-briefing-back').addEventListener('click', returnToBattleSetup);
      document.getElementById('battle-briefing-start').addEventListener('click', () => {
        if (!battleBriefingOpen) return;
        closeBattleBriefing(); document.getElementById('combat-preview-back').focus({ preventScroll: true }); scheduleCombatPreview();
      });
      document.getElementById('battle-briefing').addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); returnToBattleSetup(); }
        if (event.key === 'Tab') {
          const buttons = Array.from(event.currentTarget.querySelectorAll('button')), first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      });
      document.getElementById('game-characters').addEventListener('click', () => {
        showGameView('characters');
        document.getElementById('game-home').focus({ preventScroll: true });
      });
      let selectedCharacterCard = null;
      // 실제 게임 저장 데이터 연결 전까지 유지하는 편성 미리보기입니다.
      const previewFormations = [{ name: '편성 1', members: Array(6).fill(null) }];
      let selectedFormation = 0;
      let nextFormationNumber = 2;
      let editingFormation = null;
      let previewParty = previewFormations[0].members;
      function placePartyMember(party, index, card) {
        if (!Number.isInteger(index) || index < 0 || index >= 6 || !card) return party.slice();
        const next = party.map(member => member === card ? null : member);
        next[index] = card;
        return next;
      }
      function movePartyMember(party, index, card) {
        if (!Number.isInteger(index) || index < 0 || index >= 6 || !card) return party.slice();
        const source = party.indexOf(card);
        if (source < 0) return placePartyMember(party, index, card);
        const next = party.slice();
        [next[source], next[index]] = [next[index], next[source]];
        return next;
      }
      let partyDragState = null;
      function clearPartyDrag() {
        partyDragState = null;
        document.querySelectorAll('#party-screen [data-drop-target], #party-screen [data-dragging]').forEach(element => {
          delete element.dataset.dropTarget; delete element.dataset.dragging;
        });
      }
      function bindPartyDragSource(element, card) {
        element.draggable = true;
        element.addEventListener('dragstart', event => {
          if (!event.dataTransfer || !previewFormations[selectedFormation]) { event.preventDefault(); return; }
          closePartyFormationMenu();
          partyDragState = { card, formation: previewFormations[selectedFormation] };
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('application/x-gacha-party-member', 'internal');
          element.dataset.dragging = 'true';
        });
        element.addEventListener('dragend', clearPartyDrag);
      }
      function bindPartyDropSlot(slot, index) {
        const canDrop = () => partyDragState && partyDragState.formation === previewFormations[selectedFormation] && document.getElementById('game-preview').dataset.view === 'party';
        slot.addEventListener('dragover', event => {
          if (!canDrop()) return;
          event.preventDefault(); event.dataTransfer.dropEffect = 'move';
          document.querySelectorAll('#party-screen [data-drop-target]').forEach(element => { if (element !== slot) delete element.dataset.dropTarget; });
          slot.dataset.dropTarget = 'true';
        });
        slot.addEventListener('dragleave', event => { if (!slot.contains(event.relatedTarget)) delete slot.dataset.dropTarget; });
        slot.addEventListener('drop', event => {
          if (!canDrop()) return;
          event.preventDefault(); event.stopPropagation();
          const next = movePartyMember(previewParty, index, partyDragState.card);
          previewParty.splice(0, 6, ...next);
          clearPartyDrag(); renderParty();
        });
      }
      document.addEventListener('dragend', clearPartyDrag);
      document.addEventListener('drop', clearPartyDrag);
      function selectPartyFormation(index) {
        if (!Number.isInteger(index) || !previewFormations[index]) return;
        selectedFormation = index;
        previewParty = previewFormations[index].members;
        editingFormation = null;
      }
      function removePartyFormation(index) {
        if (!Number.isInteger(index) || !previewFormations[index]) return false;
        const active = previewFormations[selectedFormation];
        previewFormations.splice(index, 1);
        if (!previewFormations.length) {
          selectedFormation = -1; previewParty = Array(6).fill(null); editingFormation = null;
        } else {
          const activeIndex = previewFormations.indexOf(active);
          selectPartyFormation(activeIndex >= 0 ? activeIndex : Math.min(index, previewFormations.length - 1));
        }
        return true;
      }
      let partyFormationDeleteTarget = null;
      function focusPartyFormation(formation) {
        const index = previewFormations.indexOf(formation);
        const selector = index >= 0 ? '.party-formation-select[data-formation="' + index + '"]' : '.party-formation-add';
        document.querySelector(selector)?.focus({ preventScroll: true });
      }
      function closePartyFormationMenu(restoreFocus = false) {
        document.getElementById('party-formation-menu').hidden = true;
        if (restoreFocus && partyFormationMenuTarget) focusPartyFormation(partyFormationMenuTarget);
        partyFormationMenuTarget = null;
      }
      function openPartyFormationMenu(event, formation, button) {
        event.preventDefault();
        closePartyFormationMenu(); partyFormationMenuTarget = formation;
        const menu = document.getElementById('party-formation-menu'); menu.hidden = false;
        const rect = button.getBoundingClientRect(), frame = document.querySelector('.game-frame').getBoundingClientRect();
        const pointer = event.type === 'contextmenu' && (event.clientX || event.clientY);
        const x = pointer ? event.clientX : rect.left, y = pointer ? event.clientY : rect.bottom;
        menu.style.left = Math.max(frame.left + 8, Math.min(x, frame.right - menu.offsetWidth - 8)) + 'px';
        menu.style.top = Math.max(frame.top + 8, Math.min(y, frame.bottom - menu.offsetHeight - 8)) + 'px';
        menu.querySelector('button').focus({ preventScroll: true });
      }
      document.getElementById('party-formation-menu').addEventListener('click', event => {
        const action = event.target.closest('button')?.dataset.action;
        const target = partyFormationMenuTarget;
        if (!action || !target) return;
        const index = previewFormations.indexOf(target);
        closePartyFormationMenu();
        if (index < 0) return;
        if (action === 'rename') {
          editingFormation = index; renderFormationList();
          const input = document.querySelector('.party-formation-form input'); input.focus({ preventScroll: true }); input.select();
        } else {
          partyFormationDeleteTarget = target;
          document.getElementById('party-delete-message').textContent = "'" + target.name + "' 편성을 삭제하시겠습니까?";
          document.getElementById('party-delete-dialog').showModal();
          document.getElementById('party-delete-cancel').focus({ preventScroll: true });
        }
      });
      document.getElementById('party-formation-menu').addEventListener('keydown', event => {
        const menu = event.currentTarget, buttons = Array.from(menu.querySelectorAll('button'));
        if (event.key === 'Escape' || event.key === 'Tab') { if (event.key === 'Escape') event.preventDefault(); closePartyFormationMenu(true); }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); const current = buttons.indexOf(document.activeElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
          buttons[next].focus({ preventScroll: true });
        }
      });
      document.addEventListener('pointerdown', event => { if (!event.target.closest('#party-formation-menu')) closePartyFormationMenu(); });
      document.addEventListener('contextmenu', event => { if (!event.target.closest('.party-formation')) closePartyFormationMenu(); });
      document.addEventListener('scroll', () => closePartyFormationMenu(), true);
      window.addEventListener('resize', () => closePartyFormationMenu());
      document.getElementById('party-delete-cancel').addEventListener('click', () => document.getElementById('party-delete-dialog').close());
      document.getElementById('party-delete-confirm').addEventListener('click', () => {
        const index = previewFormations.indexOf(partyFormationDeleteTarget);
        if (index >= 0) { removePartyFormation(index); renderParty(); }
        document.getElementById('party-delete-dialog').close();
      });
      document.getElementById('party-delete-dialog').addEventListener('close', () => {
        const target = partyFormationDeleteTarget; partyFormationDeleteTarget = null;
        if (document.getElementById('game-preview').dataset.view === 'party') focusPartyFormation(previewFormations.includes(target) ? target : previewFormations[selectedFormation]);
      });
      function renderFormationList() {
        closePartyFormationMenu();
        const list = document.getElementById('party-formation-list');
        const scrollTop = list.scrollTop; list.replaceChildren();
        previewFormations.forEach((formation, index) => {
          const row = document.createElement('div'); row.className = 'party-formation'; row.dataset.active = String(index === selectedFormation);
          if (editingFormation === index) {
            const form = document.createElement('form'); form.className = 'party-formation-form';
            const input = document.createElement('input'); input.type = 'text'; input.maxLength = 32; input.value = formation.name; input.required = true; input.setAttribute('aria-label', '편성 이름'); input.autocomplete = 'off';
            const actions = document.createElement('div'); actions.className = 'party-formation-form-actions';
            const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'party-formation-icon'; cancel.textContent = '×'; cancel.setAttribute('aria-label', '이름 변경 취소');
            const confirm = document.createElement('button'); confirm.type = 'submit'; confirm.className = 'party-formation-icon'; confirm.textContent = '✓'; confirm.setAttribute('aria-label', '편성 이름 저장');
            const closeEditor = () => { editingFormation = null; renderFormationList(); document.querySelector('.party-formation-select[data-formation="' + index + '"]')?.focus({ preventScroll: true }); };
            cancel.addEventListener('click', closeEditor);
            input.addEventListener('input', () => { confirm.disabled = !input.value.trim(); });
            input.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); closeEditor(); } });
            form.addEventListener('submit', event => { event.preventDefault(); const name = input.value.trim(); if (!name) return; formation.name = name; closeEditor(); renderBattleSetupControls(); });
            actions.append(cancel, confirm); form.append(input, actions); row.append(form);
          } else {
            const select = document.createElement('button'); select.type = 'button'; select.className = 'party-formation-select'; select.dataset.formation = index; select.setAttribute('aria-pressed', String(index === selectedFormation));
            select.setAttribute('aria-haspopup', 'menu');
            const title = document.createElement('strong'); title.textContent = formation.name; select.title = formation.name;
            const summary = document.createElement('small'); summary.textContent = (index === selectedFormation ? '사용 중 · ' : '') + formation.members.filter(Boolean).length + ' / 6';
            select.append(title, summary);
            select.addEventListener('click', () => { selectPartyFormation(index); renderParty(); document.querySelector('.party-formation-select[data-formation="' + index + '"]').focus({ preventScroll: true }); });
            row.addEventListener('contextmenu', event => openPartyFormationMenu(event, formation, select));
            select.addEventListener('keydown', event => { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) openPartyFormationMenu(event, formation, select); });
            row.append(select);
          }
          list.append(row);
        });
        const add = document.createElement('button'); add.type = 'button'; add.className = 'party-formation-add'; add.textContent = '+ 편성 추가';add.disabled=previewFormations.length>=20;
        add.addEventListener('click', () => {
          previewFormations.push({ name: '편성 ' + nextFormationNumber++, members: Array(6).fill(null) });
          selectPartyFormation(previewFormations.length - 1); renderParty();
          document.querySelector('.party-formation-select[data-formation="' + selectedFormation + '"]').focus({ preventScroll: true });
          list.scrollTop = list.scrollHeight;
        });
        list.append(add); list.scrollTop = scrollTop;
        alignPartyScrollRails();
      }
      function alignPartyScrollRails() {
        ['party-roster-list', 'party-formation-list'].forEach(id => {
          const list = document.getElementById(id);
          if (!list.getClientRects().length) return;
          const width = Math.max(0, list.offsetWidth - list.clientWidth) + 'px';
          if (list.style.getPropertyValue('--party-scrollbar-width') !== width) list.style.setProperty('--party-scrollbar-width', width);
        });
      }
      const partyScrollRailObserver = new ResizeObserver(alignPartyScrollRails);
      ['party-roster-list', 'party-formation-list'].forEach(id => partyScrollRailObserver.observe(document.getElementById(id)));
      function renderParty() {
        const cards = Array.from(document.querySelectorAll('#characters-screen .character-portrait-card'));
        const colors = { '3': '#858b95', '4': '#b18ae5', '5': '#e8c56c' };
        document.getElementById('party-count').textContent = previewParty.filter(Boolean).length + ' / 6';
        const front = document.getElementById('party-front'), back = document.getElementById('party-back');
        front.replaceChildren(); back.replaceChildren();
        previewParty.forEach((card, index) => {
          const position = (index < 3 ? '전열 ' : '후열 ') + (index % 3 + 1);
          const slot = document.createElement('div'); slot.className = 'party-slot';
          bindPartyDropSlot(slot, index);
          const button = document.createElement('div'); button.className = 'party-slot-select'; button.dataset.slot = index;
          button.setAttribute('role', 'img'); button.setAttribute('aria-disabled', String(previewFormations.length === 0));
          if (card) {
            bindPartyDragSource(button, card);
            const name = card.querySelector('.character-card-name').textContent;
            const info = getCharacterBaseStats(card);
            slot.style.setProperty('--rarity-color', colors[card.dataset.rarity] || colors['3']);
            button.setAttribute('aria-label', position + ' · ' + name + ' · 드래그하여 이동');
            const image = card.querySelector('img');
            if (image) { const art = document.createElement('img'); art.src = image.getAttribute('src'); art.alt = ''; button.append(art); }
            const caption = document.createElement('span'); caption.className = 'party-slot-caption';
            const title = document.createElement('strong'); title.textContent = name;
            const meta = document.createElement('small'); meta.textContent = info.role + ' · ' + info.element + ' · ' + card.querySelector('.character-card-level').textContent;
            caption.append(title, meta); button.append(caption); slot.append(button);
            const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'party-remove'; remove.textContent = '×'; remove.setAttribute('aria-label', position + ' ' + name + ' 편성 해제');
            remove.addEventListener('click', () => { previewParty[index] = null; renderParty(); });
            slot.append(remove);
          } else {
            button.setAttribute('aria-label', position + ' · 빈 슬롯 · 캐릭터를 드래그하여 배치');
            const empty = document.createElement('span'); empty.className = 'party-empty';
            const plus = document.createElement('b'); plus.textContent = '+';
            const label = document.createElement('span'); label.textContent = '캐릭터 배치';
            empty.append(plus, label); button.append(empty); slot.append(button);
          }
          (index < 3 ? front : back).append(slot);
        });
        const roster = document.getElementById('party-roster-list');
        const scrollTop = roster.scrollTop; roster.replaceChildren();
        cards.forEach((card, index) => {
          const button = document.createElement('div'); button.className = 'party-member'; button.dataset.member = index;
          button.setAttribute('role', 'img'); button.setAttribute('aria-disabled', String(previewFormations.length === 0));
          if (previewFormations.length) bindPartyDragSource(button, card);
          button.style.setProperty('--rarity-color', colors[card.dataset.rarity] || colors['3']);
          const title = document.createElement('strong'); title.textContent = card.querySelector('.character-card-name').textContent;
          const info = getCharacterBaseStats(card);
          const meta = document.createElement('small'); meta.textContent = info.role + ' · ' + info.element;
          const status = document.createElement('em'); const assigned = previewParty.indexOf(card);
          status.textContent = assigned < 0 ? '' : (assigned < 3 ? '전열 ' : '후열 ') + (assigned % 3 + 1) + ' · 편성 중';
          const image = card.querySelector('img');
          if (image) { const art = document.createElement('img'); art.src = image.getAttribute('src'); art.alt = ''; button.append(art); }
          const stars = card.querySelector('.character-card-stars')?.cloneNode(true);
          if (stars) button.append(stars);
          const caption = document.createElement('span'); caption.className = 'party-member-caption';
          const level = document.createElement('span'); level.className = 'party-member-level'; level.textContent = card.querySelector('.character-card-level').textContent;
          caption.append(title, level, meta); button.append(caption);
          if (assigned >= 0) button.append(status);
          button.setAttribute('aria-label', title.textContent + ' · ' + card.dataset.rarity + '성 · ' + level.textContent + ' · ' + meta.textContent + (assigned >= 0 ? ' · ' + status.textContent : '') + ' · 드래그하여 배치');
          roster.append(button);
        });
        roster.scrollTop = scrollTop;
        renderFormationList();
        renderBattleSetupControls();
      }
      document.getElementById('game-party').addEventListener('click', () => {
        battleStageContext = null;
        showGameView('party'); document.getElementById('game-home').focus({ preventScroll: true });
      });
      // 실제 성장 데이터 연결 전, 캐릭터별로 보관하는 미리보기 세션의 스킬 레벨입니다.
      const previewCharacterSkillLevels = new WeakMap();
      const previewCharacterOutfits = new WeakMap();
      const previewCharacterProfiles = new WeakMap();
      const previewCharacterEquipment = new WeakMap();
      const previewGameWallet={gold:live.gold};
      const previewSkillMaterials = { common: 0, '불': 0, '물': 0, '바람': 0, '땅': 0, '전기': 0, '얼음': 0, '풀': 0, '빛': 0, '어둠': 0 };
      const materialElements = {
        '불': { id: 'fire', name: '화염' }, '물': { id: 'water', name: '물결' }, '바람': { id: 'wind', name: '바람' },
        '땅': { id: 'earth', name: '대지' }, '전기': { id: 'lightning', name: '전격' }, '얼음': { id: 'ice', name: '빙결' },
        '풀': { id: 'nature', name: '신록' }, '빛': { id: 'light', name: '빛의' }, '어둠': { id: 'dark', name: '어둠의' }, common: { id: 'common', name: '공용' },
      };
      const inventoryState = { category: 'equipment', equipmentFilter: 'all', materialFilter: 'all', selectedEquipment: null };
      // 재료를 획득하는 기능이 연결되기 전까지 보유 수량은 0입니다.
      const previewInventoryMaterialCounts={...live.materials};
      const previewInventoryConsumables=[];
      function getInventoryEquipment() {
        const cards = Array.from(document.querySelectorAll('#characters-screen .character-portrait-card'));
        return getPreviewEquipmentInventory().map(item => {
          const card = cards.find(card => Object.values(getCharacterEquipment(card).equipped).includes(item.id));
          return { key: item.id, card: card || null, item, equipped: Boolean(card) };
        });
      }
      function getInventoryMaterials() {
        const growth = [
          { id: 'growth-shard', name: '성장의 조각' }, { id: 'growth-crystal', name: '성장의 결정' }, { id: 'growth-essence', name: '성장의 정수' },
        ].map(item => ({ ...item, element: 'common', image: 'assets/materials/' + item.id + '.png', quantity: previewInventoryMaterialCounts[item.id] || 0 }));
        const elemental = Object.entries(materialElements).flatMap(([element, material]) => {
          const prefix = element === 'common' ? '공용' : material.name;
          return [
            { id: 'inscription-' + material.id, name: prefix + ' 각인석', element, image: 'assets/materials/inscription-' + material.id + '.png', quantity: previewSkillMaterials[element] || 0 },
            { id: 'catalyst-' + material.id, name: prefix + ' 촉매', element, image: 'assets/materials/catalyst-' + material.id + '.png', quantity: previewInventoryMaterialCounts['catalyst-' + material.id] || 0 },
          ];
        });
        return [...growth, ...elemental].filter(item => item.quantity > 0);
      }
      function filterInventoryEntries(entries, category, filter) {
        if (filter === 'all' || category === 'consumables') return entries;
        return entries.filter(entry => category === 'equipment' ? entry.item.type === filter : entry.element === filter);
      }
      function inventoryTabKeyboard(event) {
        const vertical = event.currentTarget.getAttribute('aria-orientation') === 'vertical';
        const keys = vertical ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
        if (![...keys, 'Home', 'End'].includes(event.key)) return;
        const tabs = Array.from(event.currentTarget.querySelectorAll('[role="tab"]'));
        if (!tabs.length) return;
        event.preventDefault();
        const current = tabs.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === keys[1] ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next].click();
        if (vertical) tabs[next].focus({ preventScroll: true });
        else document.querySelector('#inventory-filters [aria-selected="true"]')?.focus({ preventScroll: true });
      }
      function renderInventoryDetails(entry) {
        const panel = document.getElementById('inventory-equipment-details'); panel.replaceChildren();
        if (!entry) {
          const empty = document.createElement('p'); empty.className = 'inventory-empty'; empty.textContent = '장비를 선택해 주세요.'; panel.append(empty);
        } else {
          panel.append(createEquipmentSheet(entry.item));
          if (entry.equipped) {
            const owner = document.createElement('p'); owner.className = 'inventory-equipment-owner'; owner.textContent = '착용 중 · ' + entry.card.querySelector('.character-card-name').textContent; panel.append(owner);
          }
        }
        document.getElementById('inventory-details').scrollTop = 0;
      }
      function renderInventory() {
        const category = inventoryState.category, equipment = category === 'equipment';
        document.querySelectorAll('[data-inventory-category]').forEach(button => {
          const active = button.dataset.inventoryCategory === category; button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
        });
        document.getElementById('inventory-content').setAttribute('aria-labelledby', 'inventory-tab-' + category);
        document.getElementById('inventory-body').dataset.category = category;
        document.getElementById('inventory-details').hidden = !equipment;
        const filters = document.getElementById('inventory-filters'), filterScroll = filters.scrollLeft; filters.replaceChildren();
        filters.hidden = category === 'consumables'; filters.setAttribute('aria-label', equipment ? '부위별 장비' : '속성별 재료');
        const activeFilter = equipment ? inventoryState.equipmentFilter : inventoryState.materialFilter;
        const options = equipment ? [{ id: 'all', name: '전체' }, ...characterEquipmentTypes] : [{ id: 'all', name: '전체' }, { id: 'common', name: '공용' }, ...Object.keys(materialElements).filter(key => key !== 'common').map(key => ({ id: key, name: key }))];
        if (category !== 'consumables') options.forEach(option => {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'inventory-filter'; button.setAttribute('role', 'tab'); button.dataset.filter = option.id;
          button.setAttribute('aria-selected', String(activeFilter === option.id)); button.tabIndex = activeFilter === option.id ? 0 : -1; button.textContent = option.name;
          button.addEventListener('click', () => {
            inventoryState[equipment ? 'equipmentFilter' : 'materialFilter'] = option.id;
            inventoryState.selectedEquipment = null; renderInventory();
            document.querySelector('#inventory-filters [aria-selected="true"]')?.focus({ preventScroll: true });
          }); filters.append(button);
        });
        filters.scrollLeft = filterScroll;
        const allEntries = equipment ? getInventoryEquipment() : category === 'materials' ? getInventoryMaterials() : previewInventoryConsumables.filter(item => item.quantity > 0);
        const entries = filterInventoryEntries(allEntries, category, activeFilter);
        document.getElementById('inventory-count').textContent = entries.length + (equipment ? '개' : '종');
        const grid = document.getElementById('inventory-item-grid'); grid.replaceChildren();
        entries.forEach(entry => {
          const tile = document.createElement(equipment ? 'button' : 'div'); tile.className = 'inventory-item';
          const name = document.createElement('span'); name.className = 'inventory-item-name'; name.textContent = equipment ? entry.item.name : entry.name;
          if (equipment) {
            applyEquipmentRarity(tile, entry.item);
            tile.type = 'button'; tile.dataset.inventoryItem = entry.key; tile.setAttribute('aria-pressed', String(inventoryState.selectedEquipment === entry.key));
            tile.setAttribute('aria-label', equipmentDisplayName(entry.item) + ' · ' + getEquipmentRarity(entry.item) + '성' + (entry.equipped ? ' · 착용 중' : '') + ' · 옵션 보기');
            const stage = document.createElement('span'); stage.className = 'inventory-item-stage'; stage.textContent = '+' + entry.item.enhancement;
            tile.append(stage, createEquipmentIcon(entry.item), createEquipmentStars(entry.item));
            if (entry.equipped) { const badge = document.createElement('span'); badge.className = 'inventory-item-equipped'; badge.textContent = '착용'; tile.append(badge); }
            tile.addEventListener('click', () => {
              inventoryState.selectedEquipment = entry.key;
              grid.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button === tile)));
              renderInventoryDetails(entry);
            });
          } else {
            const image = document.createElement('img'); image.src = entry.image; image.alt = ''; image.loading = 'lazy'; tile.append(image);
            const quantity = document.createElement('span'); quantity.className = 'inventory-item-quantity'; quantity.textContent = '×' + entry.quantity.toLocaleString('ko-KR'); tile.append(quantity);
            tile.setAttribute('aria-label', entry.name + ' · 보유 ' + entry.quantity + '개');
          }
          tile.title = name.textContent; tile.append(name); grid.append(tile);
        });
        if (!entries.length) {
          const empty = document.createElement('p'); empty.className = 'inventory-empty';
          empty.textContent = equipment ? '보유한 장비가 없습니다.' : category === 'materials' ? '보유한 재료가 없습니다.' : '보유한 소비 아이템이 없습니다.'; grid.append(empty);
        }
        if (equipment) renderInventoryDetails(entries.find(entry => entry.key === inventoryState.selectedEquipment));
        document.getElementById('inventory-item-scroll').scrollTop = 0;
      }
      document.querySelector('.inventory-categories').addEventListener('click', event => {
        const button = event.target.closest('[data-inventory-category]'); if (!button) return;
        inventoryState.category = button.dataset.inventoryCategory; renderInventory();
      });
      document.querySelector('.inventory-categories').addEventListener('keydown', inventoryTabKeyboard);
      document.getElementById('inventory-filters').addEventListener('keydown', inventoryTabKeyboard);
      document.getElementById('game-inventory').addEventListener('click', () => { showGameView('inventory'); document.getElementById('game-home').focus({ preventScroll: true }); });
      // 배너 구성과 출현 대상은 화면 확인용이며 실제 소환 규칙은 아직 연결하지 않았습니다.
      const previewSummonBanners = [
        { id: 'standard', name: '상시 캐릭터 소환', label: '상시 배너', kind: 'character', description: '함께할 동료를 만나보세요.', tint: '#2b3c59', imageUrl: null },
      ];
      let selectedSummonBanner = 'standard';
      let summonDialogReturnFocus = null;
      function getSelectedSummonBanner() { return previewSummonBanners.find(banner => banner.id === selectedSummonBanner) || previewSummonBanners[0]; }
      function createSummonMark() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.2'); svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z'); svg.append(path); return svg;
      }
      function renderSummon() {
        const selected = getSelectedSummonBanner();
        const list = document.getElementById('summon-banner-list'), scrollTop = list.scrollTop; list.replaceChildren();
        previewSummonBanners.forEach(banner => {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'summon-banner-choice'; button.id = 'summon-tab-' + banner.id; button.dataset.banner = banner.id;
          button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', 'summon-banner'); button.setAttribute('aria-selected', String(banner.id === selected.id)); button.tabIndex = banner.id === selected.id ? 0 : -1; button.style.setProperty('--summon-tint', banner.tint);
          const thumbnail = document.createElement('span'); thumbnail.className = 'summon-banner-thumbnail';
          if (banner.imageUrl) { const image = document.createElement('img'); image.src = banner.imageUrl; image.alt = ''; thumbnail.append(image); } else thumbnail.append(createSummonMark());
          const copy = document.createElement('span'); copy.className = 'summon-banner-choice-copy';
          const title = document.createElement('strong'); title.textContent = banner.name;
          copy.append(title); button.append(thumbnail, copy);
          button.addEventListener('click', () => { selectedSummonBanner = banner.id; renderSummon(); document.getElementById('summon-tab-' + banner.id).focus({ preventScroll: true }); }); list.append(button);
        });
        list.scrollTop = scrollTop;
        document.getElementById('summon-banner').style.setProperty('--summon-tint', selected.tint);
        document.getElementById('summon-banner').setAttribute('aria-labelledby', 'summon-tab-' + selected.id);
        document.getElementById('summon-banner-kind').textContent = selected.label;
        document.getElementById('summon-banner-name').textContent = selected.name;
        document.getElementById('summon-banner-description').textContent = selected.description;
        document.getElementById('summon-status').textContent = '';
        const art = document.getElementById('summon-banner-art'); art.replaceChildren();
        if (selected.imageUrl) {
          const image = document.createElement('img'); image.src = selected.imageUrl; image.alt = selected.name + ' 배너 이미지'; art.append(image);
        } else {
          const placeholder = document.createElement('div'); placeholder.className = 'summon-art-placeholder';
          const label = document.createElement('span'); label.textContent = '배너 이미지 준비 중'; placeholder.append(createSummonMark(), label); art.append(placeholder);
        }
      }
      function getSummonPreviewAppearances(banner) {
        const cards = Array.from(document.querySelectorAll('#characters-screen .character-portrait-card'));
        if (banner.kind === 'equipment') return cards.length ? getCharacterEquipment(cards[0]).items.map(item => ({ item })) : [];
        const candidates = banner.kind === 'featured' ? cards.filter(card => Number(card.dataset.rarity) === 5) : cards;
        return candidates.map(card => ({ card }));
      }
      function renderSummonCharacterAppearances(entries, body) {
        [5, 4, 3].forEach(rarity => {
          const characters = entries.filter(entry => entry.card && getEquipmentRarity({ rarity: entry.card.dataset.rarity }) === rarity);
          if (!characters.length) return;
          const group = document.createElement('section'); group.className = 'summon-rarity-group'; group.setAttribute('aria-label', rarity + '성 캐릭터'); applyEquipmentRarity(group, { rarity });
          const heading = document.createElement('h3'); heading.className = 'summon-rarity-heading'; heading.append(createEquipmentStars({ rarity })); group.append(heading);
          const grid = document.createElement('div'); grid.className = 'summon-rarity-cards';
          characters.forEach(({ card }) => {
            const tile = document.createElement('article'); tile.className = 'summon-appearance-card'; applyEquipmentRarity(tile, { rarity });
            const image = card.querySelector('img');
            if (image) { const art = document.createElement('img'); art.src = image.getAttribute('src'); art.alt = ''; art.loading = 'lazy'; tile.append(art); }
            else tile.append(createSummonMark());
            const stars = createEquipmentStars({ rarity }); tile.append(stars);
            const caption = document.createElement('div'); caption.className = 'summon-appearance-caption';
            const name = document.createElement('strong'); name.textContent = card.querySelector('.character-card-name').textContent;
            const info = getCharacterBaseStats(card), details = document.createElement('small'); details.textContent = info.element + ' · ' + info.role;
            caption.append(name, details); tile.append(caption); grid.append(tile);
          });
          group.append(grid); body.append(group);
        });
      }
      function openSummonDialog(kind, trigger) {
        const banner = getSelectedSummonBanner(), appearances = kind === 'appearances'; summonDialogReturnFocus = trigger;
        document.getElementById('summon-dialog-title').textContent = appearances ? '출현 목록' : '소환 기록';
        document.getElementById('summon-dialog-subtitle').textContent = banner.name + (appearances ? ' · 미리보기' : '');
        const body = document.getElementById('summon-dialog-body'); body.replaceChildren();
        const entries = appearances ? getSummonPreviewAppearances(banner) : [];
        if (entries.some(entry => entry.card)) renderSummonCharacterAppearances(entries, body);
        else entries.forEach(entry => {
          const row = document.createElement('div'); row.className = 'summon-appearance-row';
          const name = document.createElement('div'); name.className = 'summon-appearance-name';
          if (entry.item) {
            applyEquipmentRarity(row, entry.item); row.append(createEquipmentIcon(entry.item));
            name.textContent = entry.item.name;
            const type = document.createElement('small'); type.textContent = characterEquipmentTypes.find(type => type.id === entry.item.type)?.name || '장비'; name.append(type); row.append(name, createEquipmentStars(entry.item));
          } else {
            const portrait = document.createElement('div'); portrait.className = 'summon-appearance-portrait';
            const image = entry.card.querySelector('img');
            if (image) { const art = document.createElement('img'); art.src = image.getAttribute('src'); art.alt = ''; portrait.append(art); } else portrait.append(createSummonMark());
            name.textContent = entry.card.querySelector('.character-card-name').textContent;
            const info = getCharacterBaseStats(entry.card), description = document.createElement('small'); description.textContent = info.role + ' · ' + info.element; name.append(description);
            const stars = document.createElement('span'); stars.className = 'summon-character-stars'; stars.textContent = '★'.repeat(Number(entry.card.dataset.rarity)); stars.setAttribute('aria-label', entry.card.dataset.rarity + '성'); stars.style.setProperty('--rarity-color', { 3: '#858b95', 4: '#b18ae5', 5: '#e8c56c' }[entry.card.dataset.rarity]); row.append(portrait, name, stars);
          }
          body.append(row);
        });
        if (!entries.length) { const empty = document.createElement('p'); empty.className = 'summon-dialog-empty'; empty.textContent = appearances ? '출현 대상이 없습니다.' : '소환 기록이 없습니다.'; body.append(empty); }
        document.getElementById('summon-dialog').showModal(); body.scrollTop = 0;
        document.getElementById('summon-dialog-close').focus({ preventScroll: true });
      }
      document.getElementById('summon-banner-list').addEventListener('keydown', event => {
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const current = previewSummonBanners.findIndex(banner => banner.id === selectedSummonBanner);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? previewSummonBanners.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + previewSummonBanners.length) % previewSummonBanners.length;
        selectedSummonBanner = previewSummonBanners[next].id; renderSummon(); document.getElementById('summon-tab-' + selectedSummonBanner).focus({ preventScroll: true });
      });
      document.getElementById('summon-history').addEventListener('click', event => openSummonDialog('history', event.currentTarget));
      document.getElementById('summon-appearances').addEventListener('click', event => openSummonDialog('appearances', event.currentTarget));
      document.getElementById('summon-dialog-close').addEventListener('click', () => document.getElementById('summon-dialog').close());
      document.getElementById('summon-dialog').addEventListener('close', () => { if (document.getElementById('game-preview').dataset.view === 'summon') summonDialogReturnFocus?.focus({ preventScroll: true }); });
      document.getElementById('game-summon').addEventListener('click', () => { showGameView('summon'); document.getElementById('game-home').focus({ preventScroll: true }); });
      const materialDungeonKinds = [
        { id: 'growth', name: '성장', reward: '성장 재료' }, { id: 'gold', name: '골드', reward: '골드' },
        { id: 'equipment', name: '장비', reward: '장비' }, { id: 'skill', name: '스킬 강화', reward: '각인석', elemental: true },
        { id: 'breakthrough', name: '돌파', reward: '촉매', elemental: true },
      ];
      const dungeonElementNames = { fire: '불', water: '물', wind: '바람', earth: '땅', lightning: '전기', ice: '얼음', nature: '풀', light: '빛', dark: '어둠' };
      const dungeonWeekElements = [['light', 'dark'], ['fire'], ['water'], ['wind'], ['earth'], ['lightning'], ['ice', 'nature']];
      function getKoreanDungeonDay(now = Date.now()) {
        const offset = 9 * 60 * 60 * 1000;
        const local = new Date(now + offset);
        return { key: local.toISOString().slice(0, 10), elements: dungeonWeekElements[local.getUTCDay()].slice(), nextAt: (Math.floor((now + offset) / 86400000) + 1) * 86400000 - offset };
      }
      const dungeonScreenState = { category: 'growth', element: null, floor: 1 };
      const dungeonFloorProgress = new Map();
      function getDungeonProgressKey(category, element) { return category + ':' + (['skill', 'breakthrough'].includes(category) ? element : 'common'); }
      function getDungeonFloorState(category, element, floor) {
        const progress = dungeonFloorProgress.get(getDungeonProgressKey(category, element)) || [0, 0, 0, 0, 0];
        return { stars: progress[floor - 1] || 0, unlocked: floor === 1 || (progress[floor - 2] || 0) > 0 };
      }
      function recordDungeonFloorClear(category, element, floor, stars = 3) {
        if (!materialDungeonKinds.some(kind => kind.id === category) || !Number.isInteger(floor) || floor < 1 || floor > 5 || !Number.isInteger(stars) || stars < 1 || stars > 3) return false;
        if (['skill', 'breakthrough'].includes(category) && !Object.hasOwn(dungeonElementNames, element)) return false;
        if (!getDungeonFloorState(category, element, floor).unlocked) return false;
        const key = getDungeonProgressKey(category, element), progress = (dungeonFloorProgress.get(key) || [0, 0, 0, 0, 0]).slice();
        progress[floor - 1] = Math.max(progress[floor - 1], stars); dungeonFloorProgress.set(key, progress); return true;
      }
      let currentDungeonDay = getKoreanDungeonDay();
      function getDungeonImage(category, element) {
        return 'assets/dungeons/' + category + (['skill', 'breakthrough'].includes(category) ? '-' + element : '') + '.png';
      }
      function updateDungeonCountdown(now = Date.now()) {
        const seconds = Math.max(0, Math.ceil((currentDungeonDay.nextAt - now) / 1000));
        const label = '다음 변경까지 ' + [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
        ['materials-reset-countdown', 'dungeon-reset-countdown'].forEach(id => { document.getElementById(id).textContent = label; });
      }
      function refreshDungeonSchedule(now = Date.now()) {
        const next = getKoreanDungeonDay(now), changed = next.key !== currentDungeonDay.key;
        currentDungeonDay = next;
        if (!next.elements.includes(dungeonScreenState.element)) dungeonScreenState.element = next.elements[0];
        if (changed) {
          const view = document.getElementById('game-preview').dataset.view;
          if (view === 'materials') renderMaterialDungeons();
          if (view === 'material-dungeon') renderMaterialDungeon();
        }
        updateDungeonCountdown(now);
      }
      function getOpenDungeonCards(day = currentDungeonDay) {
        return materialDungeonKinds.flatMap(kind => (kind.elemental ? day.elements : [null]).map(element => ({ kind, element, id: 'dungeon-choice-' + kind.id + (element ? '-' + element : '') })));
      }
      function renderMaterialDungeons() {
        const track = document.getElementById('dungeon-selection-track'); track.replaceChildren();
        getOpenDungeonCards().forEach(({ kind, element, id }, index) => {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'dungeon-choice'; button.id = id;
          button.style.setProperty('--dungeon-enter-delay', index * 70 + 'ms');
          const image = document.createElement('img'); image.src = getDungeonImage(kind.id, element); image.alt = ''; image.draggable = false;
          const copy = document.createElement('span'); copy.className = 'dungeon-choice-copy';
          const title = document.createElement('strong'); title.textContent = kind.name;
          const reward = document.createElement('small'); reward.textContent = kind.reward; copy.append(title, reward); button.append(image, copy);
          if (kind.elemental) {
            const elements = document.createElement('span'); elements.className = 'dungeon-open-elements';
            const badge = document.createElement('span'); badge.textContent = dungeonElementNames[element]; elements.append(badge); button.append(elements);
          }
          button.setAttribute('aria-label', (element ? dungeonElementNames[element] + ' ' : '') + kind.name + ' 던전');
          button.addEventListener('click', () => {
            refreshDungeonSchedule();
            if (element && !currentDungeonDay.elements.includes(element)) return;
            dungeonScreenState.category = kind.id; dungeonScreenState.element = element || currentDungeonDay.elements[0]; dungeonScreenState.floor = 1;
            showGameView('material-dungeon'); document.getElementById('material-dungeon-back').focus({ preventScroll: true });
          }); track.append(button);
        });
      }
      function getDungeonRewards(category, element) {
        if (category === 'growth') return [{ id: 'growth-shard', name: '성장의 조각' }, { id: 'growth-crystal', name: '성장의 결정' }, { id: 'growth-essence', name: '성장의 정수' }];
        if (category === 'gold') return [{ name: '골드', gold: true }];
        if (category === 'equipment') return characterEquipmentTypes.map(type => ({ name: type.name, equipment: type.id }));
        const korean = dungeonElementNames[element], prefix = materialElements[korean].name;
        return [{ id: (category === 'skill' ? 'inscription-' : 'catalyst-') + element, name: prefix + (category === 'skill' ? ' 각인석' : ' 촉매') }];
      }
      function renderMaterialDungeon() {
        const kind = materialDungeonKinds.find(kind => kind.id === dungeonScreenState.category) || materialDungeonKinds[0];
        if (!currentDungeonDay.elements.includes(dungeonScreenState.element)) dungeonScreenState.element = currentDungeonDay.elements[0];
        const element = dungeonScreenState.element;
        if (!getDungeonFloorState(kind.id, element, dungeonScreenState.floor).unlocked) dungeonScreenState.floor = 1;
        const name = (kind.elemental ? dungeonElementNames[element] + ' · ' : '') + kind.name + ' 던전';
        document.getElementById('material-dungeon-title').textContent = name;
        document.getElementById('dungeon-detail-name').textContent = name + ' · ' + dungeonScreenState.floor + '층';
        const image = document.getElementById('dungeon-detail-image'), src = getDungeonImage(kind.id, element);
        if (image.getAttribute('src') !== src) image.src = src;
        image.alt = name;
        document.getElementById('dungeon-reset-countdown').parentElement.hidden = !kind.elemental;
        const floors = document.getElementById('dungeon-floor-list'), scrollTop = floors.scrollTop; floors.replaceChildren();
        // 이전 층을 클리어해야 다음 층이 열립니다. 전투 결과에서 recordDungeonFloorClear를 호출합니다.
        for (let floor = 1; floor <= 5; floor++) {
          const state = getDungeonFloorState(kind.id, element, floor);
          const button = document.createElement('button'); button.type = 'button'; button.className = 'dungeon-floor'; button.dataset.floor = floor; button.disabled = !state.unlocked; button.setAttribute('aria-pressed', String(floor === dungeonScreenState.floor)); button.setAttribute('aria-label', floor + '층 · ' + (!state.unlocked ? '잠김 · ' + (floor - 1) + '층 클리어 후 개방' : state.stars ? state.stars + '별 클리어' : '미클리어'));
          const label = document.createElement('span'); label.textContent = floor + '층'; const stars = document.createElement('span'); stars.className = 'dungeon-floor-stars'; stars.textContent = '★'.repeat(state.stars) + '☆'.repeat(3 - state.stars); stars.dataset.cleared = String(state.stars > 0); stars.setAttribute('aria-hidden', 'true'); button.append(label, stars);
          button.addEventListener('click', () => { refreshDungeonSchedule(); if (!getDungeonFloorState(kind.id, dungeonScreenState.element, floor).unlocked) return; dungeonScreenState.floor = floor; renderMaterialDungeon(); document.querySelector('.dungeon-floor[data-floor="' + floor + '"]').focus({ preventScroll: true }); }); floors.append(button);
        }
        floors.scrollTop = scrollTop;
        const rewards = document.getElementById('dungeon-rewards'); rewards.replaceChildren();
        getDungeonRewards(kind.id, element).forEach(reward => {
          const tile = document.createElement('div'); tile.className = 'dungeon-reward'; tile.title = reward.name; tile.setAttribute('role', 'img'); tile.setAttribute('aria-label', reward.name);
          if (reward.gold) {
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('fill', 'none'); icon.setAttribute('stroke', 'currentColor'); icon.setAttribute('stroke-width', '1.6'); icon.innerHTML = '<circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12"/>'; tile.append(icon);
          } else if (reward.equipment) tile.append(createEquipmentIcon(reward.equipment));
          else { const image = document.createElement('img'); image.src = 'assets/materials/' + reward.id + '.png'; image.alt = ''; tile.append(image); }
          rewards.append(tile);
        });
        document.getElementById('dungeon-prepare-status').textContent = '';
      }
      document.getElementById('materials-entry-card').addEventListener('click', () => { showGameView('materials'); document.getElementById('materials-back').focus({ preventScroll: true }); });
      document.getElementById('materials-back').addEventListener('click', () => { showGameView('battle'); document.getElementById('materials-entry-card').focus({ preventScroll: true }); });
      document.getElementById('material-dungeon-back').addEventListener('click', () => {
        showGameView('materials');
        const card = getOpenDungeonCards().find(entry => entry.kind.id === dungeonScreenState.category && (!entry.element || entry.element === dungeonScreenState.element));
        document.getElementById(card?.id || 'materials-back').focus({ preventScroll: true });
      });
      document.getElementById('dungeon-prepare').addEventListener('click', () => {
        refreshDungeonSchedule(); renderMaterialDungeon();
        const kind = materialDungeonKinds.find(kind => kind.id === dungeonScreenState.category) || materialDungeonKinds[0];
        const element = kind.elemental ? dungeonElementNames[dungeonScreenState.element] + ' · ' : '';
        const descriptions = {
          growth: '반복 훈련을 위해 배치된 수호체들이 기다리고 있습니다. 적의 전투 방식을 확인하고 수련장을 돌파하세요.',
          gold: '보물고를 지키는 수호체들이 침입자를 경계하고 있습니다. 방어선을 무너뜨리고 안쪽으로 진입하세요.',
          equipment: '병기고의 수호체들이 전열과 후열을 이루고 있습니다. 적의 배치를 확인하고 전투를 준비하세요.',
          skill: '속성의 힘을 머금은 수호체들이 각인석을 지키고 있습니다. 적의 공격 방식에 맞춰 대응하세요.',
          breakthrough: '촉매의 힘으로 움직이는 수호체들이 시험을 기다리고 있습니다. 모든 적을 처치하고 시련을 통과하세요.',
        };
        openBattleStageSetup({ source: 'dungeon', title: element + kind.name + ' 던전 · ' + dungeonScreenState.floor + '층', subtitle: '재료 던전',
          objective: '모든 적을 처치하고 던전을 돌파하세요.', description: descriptions[kind.id], image: getDungeonImage(kind.id, dungeonScreenState.element),
          category: kind.id, element: dungeonScreenState.element, floor: dungeonScreenState.floor });
      });
      const dungeonCardScroll = document.getElementById('dungeon-selection-scroll');
      let dungeonCardDrag = null;
      let dungeonCardClickBlockedUntil = 0;
      dungeonCardScroll.addEventListener('pointerdown', event => {
        if (event.pointerType !== 'mouse' || event.button !== 0 || dungeonCardScroll.scrollWidth <= dungeonCardScroll.clientWidth) return;
        dungeonCardDrag = { pointerId: event.pointerId, x: event.clientX, scrollLeft: dungeonCardScroll.scrollLeft, moved: false };
      });
      dungeonCardScroll.addEventListener('pointermove', event => {
        if (!dungeonCardDrag || event.pointerId !== dungeonCardDrag.pointerId) return;
        const distance = event.clientX - dungeonCardDrag.x;
        if (!dungeonCardDrag.moved && Math.abs(distance) < 6) return;
        if (!dungeonCardDrag.moved) {
          dungeonCardDrag.moved = true; dungeonCardScroll.dataset.dragging = 'true';
          dungeonCardScroll.setPointerCapture(event.pointerId);
        }
        event.preventDefault(); dungeonCardScroll.scrollLeft = dungeonCardDrag.scrollLeft - distance;
      });
      function finishDungeonCardDrag(event) {
        if (!dungeonCardDrag || event.pointerId !== dungeonCardDrag.pointerId) return;
        const moved = dungeonCardDrag.moved; dungeonCardDrag = null;
        delete dungeonCardScroll.dataset.dragging;
        if (moved) dungeonCardClickBlockedUntil = Date.now() + 350;
        if (dungeonCardScroll.hasPointerCapture(event.pointerId)) dungeonCardScroll.releasePointerCapture(event.pointerId);
      }
      window.addEventListener('pointerup', finishDungeonCardDrag);
      window.addEventListener('pointercancel', finishDungeonCardDrag);
      dungeonCardScroll.addEventListener('lostpointercapture', finishDungeonCardDrag);
      dungeonCardScroll.addEventListener('click', event => {
        if (event.detail > 0 && Date.now() < dungeonCardClickBlockedUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
      }, true);
      setInterval(() => { if (['materials', 'material-dungeon'].includes(document.getElementById('game-preview').dataset.view)) refreshDungeonSchedule(); }, 1000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden && ['materials', 'material-dungeon'].includes(document.getElementById('game-preview').dataset.view)) refreshDungeonSchedule(); });
      const skillUpgradeRules = { maxLevel: 10, goldCost: 300000, materialCount: 1 };
      let skillUpgradeTarget = null;
      let equipmentEnhancementTarget = null;
      function openCharacterDetail(card) {
        selectedCharacterCard = card;
        selectCharacterTab(document.getElementById('character-tab-info'));
        renderCharacterInfo(card);
        renderCharacterSkills(card);
        selectCharacterSkill('basic');
        renderCharacterAwakening(card);
        document.getElementById('character-panel-awakening').scrollTop = 0;
        const outfits = getCharacterOutfits(card);
        outfits.selectedId = outfits.equippedId;
        renderCharacterOutfits(card);
        document.getElementById('character-panel-outfits').scrollTop = 0;
        renderCharacterAffinity(card);
        document.getElementById('character-panel-affinity').scrollTop = 0;
        renderCharacterProfile(card);
        document.getElementById('character-panel-profile').scrollTop = 0;
        getCharacterEquipment(card).selectedType = 'weapon';
        renderCharacterEquipment(card);
        document.getElementById('character-panel-equipment').scrollTop = 0;
        document.getElementById('character-panel-skills').scrollTop = 0;
        const name = card.querySelector('.character-card-name').textContent;
        document.getElementById('character-detail-name').textContent = name;
        document.getElementById('character-detail-level').textContent = card.querySelector('.character-card-level').textContent;
        const stars = document.getElementById('character-detail-stars');
        stars.replaceChildren(...Array.from(card.querySelectorAll('.character-card-stars svg'), star => star.cloneNode(true)));
        stars.style.color = getComputedStyle(card).getPropertyValue('--rarity-color');
        stars.setAttribute('aria-label', card.dataset.rarity + '성');
        syncCharacterOutfitImage(card);
        showGameView('character-detail');
        document.getElementById('character-detail-screen').scrollTop = 0;
        document.getElementById('character-detail-back').focus({ preventScroll: true });
      }
      document.querySelectorAll('.character-portrait-card').forEach(card => {
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        card.addEventListener('click', () => openCharacterDetail(card));
        card.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!event.repeat) openCharacterDetail(card);
          }
        });
      });
      document.getElementById('character-detail-back').addEventListener('click', () => {
        showGameView('characters');
        selectedCharacterCard?.focus({ preventScroll: true });
      });
      function original_getCharacterBaseStats(card) {
        // 실제 캐릭터 생성 데이터가 연결되기 전까지 사용하는 화면 확인용 수치입니다.
        const previews = {
          '3': { power: 1250, element: '불', role: '전사', hp: 2400, attack: 180, defense: 120, speed: 100 },
          '4': { power: 1680, element: '물', role: '마법사', hp: 2100, attack: 260, defense: 105, speed: 108 },
          '5': { power: 2150, element: '빛', role: '기사', hp: 3200, attack: 210, defense: 220, speed: 95 },
        };
        return { ...(previews[card.dataset.rarity] || previews['3']), critRate: 5, critDamage: 150, effectHit: 0, effectResist: 0 };
      }
      function original_renderCharacterInfo(card) {
        const info = getCharacterEquipmentTotalStats(card);
        // 최대 레벨 20은 화면 확인용 임시 값이며, 생성된 캐릭터의 값을 우선합니다.
        const level = Number(card.dataset.level) || Number(card.querySelector('.character-card-level').textContent.match(/\d+/)?.[0]) || 1;
        const maxLevel = Number(card.dataset.maxLevel) || 20;
        const growthButton = document.getElementById('character-growth-button');
        growthButton.textContent = level >= maxLevel ? '돌파' : '레벨업';
        growthButton.dataset.action = level >= maxLevel ? 'breakthrough' : 'level-up';
        const values = {
          'character-info-power': info.power.toLocaleString('ko-KR'),
          'character-info-level': 'Lv. ' + level + ' / ' + maxLevel,
          'character-info-exp-count': '0 / 100',
          'character-info-element': info.element,
          'character-info-class': info.role,
          'character-stat-hp': info.hp.toLocaleString('ko-KR'),
          'character-stat-attack': info.attack.toLocaleString('ko-KR'),
          'character-stat-defense': info.defense.toLocaleString('ko-KR'),
          'character-stat-speed': String(info.speed),
          'character-stat-crit-rate': info.critRate + '%',
          'character-stat-crit-damage': info.critDamage + '%',
          'character-stat-effect-hit': info.effectHit + '%',
          'character-stat-effect-resist': info.effectResist + '%',
        };
        Object.entries(values).forEach(([id, value]) => { document.getElementById(id).textContent = value; });
        const exp = document.getElementById('character-info-exp-bar');
        exp.value = 0; exp.max = 100;
        exp.setAttribute('aria-valuetext', '0 / 100');
        document.getElementById('character-panel-info').scrollTop = 0;
      }
      function createPlaceholderSkillIcon(key) {
        const paths = {
          basic: 'm14 3 7 0 0 7-11 11-7-7L14 3ZM6 11l7 7M3 21l4-4',
          active: 'm13 2-9 12h7l-1 8L21 9h-8l0-7Z',
          ultimate: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7ZM4 3v4M2 5h4M20 17v4M18 19h4',
          passive: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4ZM8 12l3 3 5-6',
        };
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.5'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', paths[key]); svg.append(path); return svg;
      }
      function selectCharacterSkill(key) {
        const selectors = Array.from(document.querySelectorAll('.character-skill-selector'));
        if (!selectors.some(selector => selector.dataset.skillTarget === key)) return;
        selectors.forEach(selector => {
          const selected = selector.dataset.skillTarget === key;
          selector.setAttribute('aria-selected', String(selected)); selector.tabIndex = selected ? 0 : -1;
          document.getElementById(selector.getAttribute('aria-controls')).hidden = !selected;
        });
        document.querySelector('.character-skill-content').scrollTop = 0;
        alignSkillUpgradeScroll(document.getElementById('skill-detail-' + key));
      }
      document.querySelectorAll('.character-skill-selector').forEach(selector => {
        selector.addEventListener('click', () => selectCharacterSkill(selector.dataset.skillTarget));
        selector.addEventListener('keydown', event => {
          const selectors = Array.from(document.querySelectorAll('.character-skill-selector'));
          let index = selectors.indexOf(selector);
          if (event.key === 'ArrowDown') index = (index + 1) % selectors.length;
          else if (event.key === 'ArrowUp') index = (index - 1 + selectors.length) % selectors.length;
          else if (event.key === 'Home') index = 0;
          else if (event.key === 'End') index = selectors.length - 1;
          else return;
          event.preventDefault(); selectCharacterSkill(selectors[index].dataset.skillTarget); selectors[index].focus();
        });
      });
      function original_getCharacterSkillLevels(card) {
        if (!previewCharacterSkillLevels.has(card)) previewCharacterSkillLevels.set(card, { basic: 1, active: 1, ultimate: 1, passive: 1 });
        return previewCharacterSkillLevels.get(card);
      }
      function getCharacterActiveCooldown(card, skillLevel = getCharacterSkillLevels(card).active) {
        // 캐릭터 생성 결과의 쿨타임을 우선합니다. 미리보기 캐릭터는 각각 2·4·5턴입니다.
        const preview = { '3': 2, '4': 4, '5': 5 }[card.dataset.rarity] || 3;
        const configured = Number(card.dataset.activeCooldown);
        const base = Number.isFinite(configured) && configured >= 2 && configured <= 5 ? Math.floor(configured) : preview;
        // 감소 시점은 임시로 4·8레벨에 배치합니다.
        const reductionLevels = [4, 8];
        const reduction = base >= 4 ? reductionLevels.filter(level => skillLevel >= level).length : 0;
        return { base, current: base - Math.min(2, reduction), reductionLevels };
      }
      function original_getCharacterSkillNames(card) {
        // 실제 AI 생성 스킬 이름을 연결하기 전의 캐릭터별 미리보기 이름입니다.
        const examples = {
          '3': { basic: '검의 궤적', active: '돌파의 일격', ultimate: '새벽을 가르는 빛', passive: '불굴의 의지' },
          '4': { basic: '물결의 속삭임', active: '유리숲의 파문', ultimate: '깊은 기억의 해일', passive: '흐르는 기억' },
          '5': { basic: '경계의 일격', active: '수호의 방패', ultimate: '루멘의 맹세', passive: '귀환의 약속' },
        };
        return examples[card.dataset.rarity] || examples['3'];
      }
      function getCharacterSkillUpgradeEffects(card, key) {
        // 실제 AI 생성 스킬의 단계별 효과를 연결하기 전의 미리보기입니다.
        const cooldown = getCharacterActiveCooldown(card);
        return Array.from({ length: 9 }, (_, index) => {
          const level = index + 2;
          const cooldownReduction = key === 'active' && cooldown.base >= 4 && cooldown.reductionLevels.includes(level);
          return { level, description: cooldownReduction ? '쿨타임 1턴 감소' : (key === 'passive' ? '패시브 효과 ' : '스킬 피해량 ') + (level === 10 ? 10 : 5) + '% 증가' };
        });
      }
      function renderCharacterSkillUpgrades(card, skill, level) {
        const list = skill.querySelector('.character-skill-upgrades');
        list.dataset.currentLevel = String(level);
        list.replaceChildren();
        getCharacterSkillUpgradeEffects(card, skill.dataset.skill).forEach(effect => {
          const applied = level >= effect.level;
          const row = document.createElement('li'); row.className = 'character-skill-upgrade'; row.dataset.applied = String(applied);
          row.dataset.level = String(effect.level);
          row.setAttribute('aria-label', '레벨 ' + effect.level + ' · ' + effect.description + ' · ' + (applied ? '적용됨' : '미도달'));
          const label = document.createElement('span'); label.className = 'character-skill-upgrade-level'; label.textContent = 'Lv.' + effect.level;
          const text = document.createElement('span'); text.textContent = effect.description; row.append(label, text); list.append(row);
        });
        alignSkillUpgradeScroll(skill);
      }
      function alignSkillUpgradeScroll(skill) {
        if (!skill) return;
        const list = skill.querySelector('.character-skill-upgrades');
        if (!list || !list.clientHeight) return;
        const rows = Array.from(list.querySelectorAll('.character-skill-upgrade'));
        const level = Math.max(2, Math.min(10, Number(list.dataset.currentLevel) || 2));
        const target = rows.find(row => Number(row.dataset.level) === level);
        if (!target || !rows.length) return;
        const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight);
        list.scrollTop = Math.min(maxScroll, Math.max(0, target.offsetTop - rows[0].offsetTop));
      }
      function original_renderCharacterSkills(card) {
        const levels = getCharacterSkillLevels(card);
        const names = getCharacterSkillNames(card);
        document.querySelectorAll('.character-skill-selector').forEach(selector => {
          const key = selector.dataset.skillTarget;
          selector.querySelector('.character-skill-selector-art').replaceChildren(createPlaceholderSkillIcon(key));
          selector.querySelector('.character-skill-selector-level').textContent = 'Lv.' + levels[key];
          selector.setAttribute('aria-label', { basic: '기본 스킬', active: '액티브', ultimate: '궁극기', passive: '패시브' }[key] + ' · ' + names[key] + ' · 레벨 ' + levels[key]);
        });
        const cooldown = getCharacterActiveCooldown(card);
        const cooldownLabel = document.getElementById('character-active-cooldown');
        cooldownLabel.textContent = '쿨타임 ' + cooldown.current + '턴';
        cooldownLabel.dataset.reduced = String(cooldown.current < cooldown.base);
        document.querySelectorAll('.character-skill').forEach(skill => {
          const level = levels[skill.dataset.skill];
          skill.querySelector('h3').textContent = names[skill.dataset.skill];
          renderCharacterSkillUpgrades(card, skill, level);
          skill.querySelector('.character-skill-level').textContent = 'Lv. ' + level + ' / 10';
          const button = skill.querySelector('button');
          const allMaxed = Object.values(levels).every(level => level >= skillUpgradeRules.maxLevel);
          button.disabled = allMaxed;
          button.textContent = allMaxed ? '최대 레벨' : '스킬 강화';
          button.setAttribute('aria-label', allMaxed ? '모든 스킬 최대 레벨' : '무작위 스킬 강화');
        });
      }
      function getCharacterSkillMaterialElement(card) {
        const element = card.dataset.element || getCharacterBaseStats(card).element;
        return Object.hasOwn(previewSkillMaterials, element) && element !== 'common' ? element : getCharacterBaseStats(card).element;
      }
      function calculateRandomSkillUpgrade(levels, resources, materialKey, element, random = Math.random, rules = skillUpgradeRules) {
        const eligible = ['basic', 'active', 'ultimate', 'passive'].filter(key => levels[key] < rules.maxLevel);
        if (!eligible.length) return { ok: false, message: '모든 스킬이 최대 레벨입니다.' };
        if (materialKey !== 'common' && materialKey !== element) return { ok: false, message: '해당 속성 재료 또는 공용 재료를 선택해 주세요.' };
        if (resources.gold < rules.goldCost) return { ok: false, message: '골드가 부족합니다.' };
        if ((resources.materials[materialKey] || 0) < rules.materialCount) return { ok: false, message: '강화 재료가 부족합니다.' };
        const index = Math.max(0, Math.min(eligible.length - 1, Math.floor(random() * eligible.length)));
        const key = eligible[index];
        return { ok: true, key, levels: { ...levels, [key]: levels[key] + 1 }, gold: resources.gold - rules.goldCost,
          materials: { ...resources.materials, [materialKey]: resources.materials[materialKey] - rules.materialCount } };
      }
      function openCharacterSkillUpgrade(card) {
        if (!card) return;
        const element = getCharacterSkillMaterialElement(card);
        skillUpgradeTarget = { card, element, materialKey: previewSkillMaterials[element] > 0 ? element : previewSkillMaterials.common > 0 ? 'common' : element };
        renderCharacterSkillUpgradeDialog();
        document.getElementById('skill-upgrade-dialog').showModal();
        document.getElementById('skill-upgrade-close').focus({ preventScroll: true });
      }
      function renderCharacterSkillUpgradeDialog(message = '') {
        if (!skillUpgradeTarget) return;
        const { card, element, materialKey } = skillUpgradeTarget;
        const levels = getCharacterSkillLevels(card); const names = getCharacterSkillNames(card);
        const types = { basic: '기본 스킬', active: '액티브', ultimate: '궁극기', passive: '패시브' };
        const eligible = Object.keys(types).filter(key => levels[key] < skillUpgradeRules.maxLevel);
        const targets = document.getElementById('skill-upgrade-targets'); targets.replaceChildren();
        Object.entries(types).forEach(([key, type]) => {
          const row = document.createElement('div'); row.className = 'skill-upgrade-target'; row.dataset.eligible = String(levels[key] < skillUpgradeRules.maxLevel);
          const name = document.createElement('strong'); name.textContent = names[key] + ' · ' + type;
          const level = document.createElement('span'); level.textContent = 'Lv.' + levels[key];
          const status = document.createElement('span'); status.textContent = levels[key] >= skillUpgradeRules.maxLevel ? 'MAX · 제외' : '강화 대상'; row.append(name, level, status); targets.append(row);
        });
        document.getElementById('skill-upgrade-gold-cost').textContent = '골드 ' + skillUpgradeRules.goldCost.toLocaleString('ko-KR');
        document.getElementById('skill-upgrade-gold-owned').textContent = '보유 ' + previewGameWallet.gold.toLocaleString('ko-KR');
        const options = document.getElementById('skill-upgrade-material-options'); options.replaceChildren();
        [element, 'common'].forEach(key => {
          const label = document.createElement('label'); label.className = 'skill-upgrade-material';
          const input = document.createElement('input'); input.type = 'radio'; input.name = 'skill-upgrade-material'; input.value = key; input.checked = materialKey === key;
          const material = materialElements[key];
          const image = document.createElement('img'); image.src = 'assets/materials/inscription-' + material.id + '.png'; image.alt = ''; image.width = 44; image.height = 44;
          const name = document.createElement('span'); name.textContent = material.name + ' 각인석';
          const count = document.createElement('span'); count.textContent = '보유 ' + previewSkillMaterials[key] + '개'; label.append(input, image, name, count); options.append(label);
        });
        const unavailable = !eligible.length || previewGameWallet.gold < skillUpgradeRules.goldCost || previewSkillMaterials[materialKey] < skillUpgradeRules.materialCount;
        const confirm = document.getElementById('skill-upgrade-confirm'); confirm.disabled = unavailable; confirm.textContent = !eligible.length ? '최대 레벨' : '강화';
        const result = document.getElementById('skill-upgrade-result'); result.dataset.state = 'normal';
        result.textContent = message; result.hidden = !message;
      }
      document.querySelectorAll('.character-skill').forEach(skill => {
        skill.querySelector('button').addEventListener('click', () => openCharacterSkillUpgrade(selectedCharacterCard));
      });
      document.getElementById('skill-upgrade-material-options').addEventListener('change', event => {
        if (!skillUpgradeTarget || event.target.name !== 'skill-upgrade-material') return;
        skillUpgradeTarget.materialKey = event.target.value; renderCharacterSkillUpgradeDialog();
        document.querySelectorAll('input[name="skill-upgrade-material"]').forEach(input => { if (input.checked) input.focus({ preventScroll: true }); });
      });
      document.getElementById('skill-upgrade-confirm').addEventListener('click', () => {
        if (!skillUpgradeTarget) return;
        const { card, element, materialKey } = skillUpgradeTarget;
        const levels = getCharacterSkillLevels(card);
        const result = calculateRandomSkillUpgrade(levels, { gold: previewGameWallet.gold, materials: previewSkillMaterials }, materialKey, element);
        if (!result.ok) { renderCharacterSkillUpgradeDialog(); return; }
        previewCharacterSkillLevels.set(card, result.levels); previewGameWallet.gold = result.gold; Object.assign(previewSkillMaterials, result.materials);
        const gold = document.getElementById('game-gold'); gold.textContent = result.gold.toLocaleString('ko-KR'); gold.parentElement.setAttribute('aria-label', '골드 ' + result.gold.toLocaleString('ko-KR'));
        renderCharacterSkills(card);
        renderCharacterSkillUpgradeDialog(getCharacterSkillNames(card)[result.key] + ' · Lv.' + levels[result.key] + ' → Lv.' + result.levels[result.key] + '\n강화 완료');
      });
      ['skill-upgrade-close', 'skill-upgrade-cancel'].forEach(id => document.getElementById(id).addEventListener('click', () => document.getElementById('skill-upgrade-dialog').close()));
      document.getElementById('skill-upgrade-dialog').addEventListener('close', () => {
        skillUpgradeTarget = null;
        document.querySelector('.character-skill-selector[aria-selected="true"]')?.focus({ preventScroll: true });
      });
      function getCharacterAwakeningStage(card) {
        return Math.min(10, Math.max(0, Math.floor(Number(card.dataset.awakeningStage) || 0)));
      }
      function renderCharacterAwakening(card) {
        const stage = getCharacterAwakeningStage(card);
        document.getElementById('character-awakening-stage').textContent = stage + ' / 10';
        document.getElementById('character-awakening-status').textContent = stage >= 10
          ? '최대 각성 단계에 도달했습니다.'
          : '다음 각성: ' + (stage + 1) + '단계 · 동일 캐릭터 1회 추가 획득';
        const track = document.getElementById('character-awakening-track');
        track.replaceChildren();
        for (let index = 1; index <= 10; index++) {
          const step = document.createElement('li');
          step.textContent = String(index);
          step.dataset.unlocked = String(index <= stage);
          step.setAttribute('aria-label', index + '단계 · ' + (index <= stage ? '각성 완료' : '미해금'));
          if (index === stage) step.setAttribute('aria-current', 'step');
          track.append(step);
        }
      }
      // 향후 소환의 중복 캐릭터 판정 후 호출할 연결 지점입니다.
      // 스킬 강화 수치 및 실제 소환·저장 데이터는 추후 연결합니다.
      function applyCharacterDuplicate(card) {
        if (!card) return;
        const stage = Math.min(10, getCharacterAwakeningStage(card) + 1);
        card.dataset.awakeningStage = String(stage);
        if (card === selectedCharacterCard) renderCharacterAwakening(card);
        return stage;
      }
      function original_getCharacterOutfits(card) {
        if (!previewCharacterOutfits.has(card)) {
          // 실제 보유 의상과 생성 이미지가 연결되기 전까지의 세션 미리보기입니다.
          previewCharacterOutfits.set(card, {
            equippedId: 'default', selectedId: 'default',
            items: [
              { id: 'default', name: '기본 의상', imageUrl: card.querySelector('img')?.getAttribute('src') || null },
              { id: 'preview', name: '미리보기 의상', imageUrl: null },
            ],
          });
        }
        return previewCharacterOutfits.get(card);
      }
      function renderCharacterOutfits(card) {
        const state = getCharacterOutfits(card);
        const list = document.getElementById('character-outfit-list');
        list.replaceChildren();
        document.getElementById('character-outfits-count').textContent = state.items.length + '개';
        state.items.forEach(outfit => {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'character-outfit';
          button.dataset.outfitId = outfit.id;
          button.setAttribute('aria-pressed', String(outfit.id === state.selectedId));
          button.setAttribute('aria-label', outfit.name + (outfit.id === state.equippedId ? ' · 착용 중' : ''));
          const art = document.createElement('span'); art.className = 'character-outfit-art';
          if (outfit.imageUrl) { const image = document.createElement('img'); image.src = outfit.imageUrl; image.alt = ''; art.append(image); }
          else art.textContent = '이미지 준비 전';
          const name = document.createElement('span'); name.className = 'character-outfit-name'; name.textContent = outfit.name;
          button.append(art, name);
          if (outfit.id === state.equippedId) { const badge = document.createElement('span'); badge.className = 'character-outfit-equipped'; badge.textContent = '착용 중'; button.append(badge); }
          list.append(button);
        });
        const equipped = state.items.find(item => item.id === state.equippedId);
        document.getElementById('character-outfit-status').textContent = '현재 착용: ' + equipped.name;
        const button = document.getElementById('character-outfit-equip');
        button.disabled = state.selectedId === state.equippedId;
        button.textContent = button.disabled ? '착용 중' : '착용';
      }
      function syncCharacterOutfitImage(card) {
        const state = getCharacterOutfits(card);
        const outfit = state.items.find(item => item.id === state.equippedId);
        card.querySelectorAll('img').forEach(image => image.remove());
        if (outfit.imageUrl) {
          const image = document.createElement('img'); image.src = outfit.imageUrl; image.alt = ''; image.className = 'character-equipped-image'; card.prepend(image);
        }
        if (card === selectedCharacterCard) {
          const illustration = document.getElementById('character-detail-illustration');
          illustration.replaceChildren();
          if (outfit.imageUrl) { const image = document.createElement('img'); image.src = outfit.imageUrl; image.alt = ''; illustration.append(image); }
          illustration.setAttribute('aria-label', card.querySelector('.character-card-name').textContent + ' · ' + outfit.name + ' 일러스트' + (outfit.imageUrl ? '' : ' · 이미지 준비 전'));
        }
      }
      function equipCharacterOutfit(card, outfitId) {
        if (!card) return false;
        const state = getCharacterOutfits(card);
        if (!state.items.some(item => item.id === outfitId)) return false;
        state.equippedId = outfitId; state.selectedId = outfitId;
        syncCharacterOutfitImage(card);
        if (card === selectedCharacterCard) renderCharacterOutfits(card);
        return true;
      }
      document.getElementById('character-outfit-list').addEventListener('click', event => {
        const button = event.target.closest('.character-outfit');
        if (!button || !selectedCharacterCard) return;
        const state = getCharacterOutfits(selectedCharacterCard);
        state.selectedId = button.dataset.outfitId;
        renderCharacterOutfits(selectedCharacterCard);
        document.querySelectorAll('.character-outfit').forEach(item => { if (item.dataset.outfitId === state.selectedId) item.focus({ preventScroll: true }); });
      });
      document.getElementById('character-outfit-equip').addEventListener('click', () => {
        if (!selectedCharacterCard) return;
        equipCharacterOutfit(selectedCharacterCard, getCharacterOutfits(selectedCharacterCard).selectedId);
      });
      function original_getCharacterAffinity(card) {
        // 실제 호감도 데이터가 연결되기 전의 기본 미리보기 값은 1입니다.
        const value = Number(card.dataset.affinity ?? 1);
        return Number.isFinite(value) ? Math.min(10, Math.max(0, Math.floor(value))) : 1;
      }
      function renderCharacterAffinity(card) {
        const affinity = getCharacterAffinity(card);
        document.getElementById('character-affinity-value').textContent = affinity + ' / 10';
        const progress = document.getElementById('character-affinity-progress');
        progress.value = affinity;
        progress.setAttribute('aria-valuetext', '호감도 ' + affinity + ' / 10');
        const next = [3, 6, 9].find(required => affinity < required);
        document.getElementById('character-affinity-next').textContent = affinity >= 10
          ? '최대 호감도에 도달했습니다.'
          : next ? '호감도 ' + next + '에 도달하면 다음 캐릭터 스토리가 해금됩니다.' : '모든 캐릭터 스토리가 해금되었습니다.';
        document.querySelectorAll('.character-affinity-story').forEach(story => {
          const required = Number(story.dataset.requiredAffinity);
          const unlocked = affinity >= required;
          story.dataset.unlocked = String(unlocked);
          const status = story.querySelector('.character-affinity-story-status');
          status.replaceChildren();
          if (!unlocked) {
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('fill', 'none'); icon.setAttribute('stroke', 'currentColor'); icon.setAttribute('stroke-width', '1.6'); icon.setAttribute('aria-hidden', 'true');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z'); icon.append(path); status.append(icon);
          }
          const label = document.createElement('span'); label.textContent = unlocked ? '해금' : '잠김'; status.append(label);
          story.querySelector('p').textContent = unlocked ? '호감도 ' + required + ' 달성 · 스토리 해금 완료' : '호감도 ' + required + ' 달성 시 해금';
        });
      }
      function original_getCharacterProfile(card) {
        if (!previewCharacterProfiles.has(card)) {
          // 화면 확인용 예시입니다. 향후 AI 생성 결과의 기본 항목과
          // additionalFields: [{ label, value }] 및 backgroundStory를 연결합니다.
          const examples = {
            '3': {
              age: '24세', gender: '여성', appearance: '짧은 적갈색 머리와 호박색 눈. 손등에는 오래된 흉터가 남아 있다.',
              personality: '솔직하고 행동이 빠르다. 곤란한 사람을 보면 쉽게 지나치지 못한다.',
              traits: '낯선 길을 잘 기억하며, 여행 중 만난 사람들의 이름을 작은 수첩에 적는다.',
              additionalFields: [{ label: '출신지', value: '남부 변경의 작은 항구 마을' }, { label: '소속', value: '새벽길 탐사단' }],
              backgroundStory: '해무가 짙게 내려앉던 어느 날, 고향의 등대가 아무런 예고 없이 꺼졌다. 남겨진 것은 낯선 문양이 새겨진 나침반 하나뿐이었다.\n\n그는 나침반의 바늘이 가리키는 곳을 따라 여행을 시작했다. 길 위에서 만난 이들과 동행하며, 자신이 찾던 답이 고향 밖의 세계와 이어져 있음을 알게 된다.',
            },
            '4': {
              age: '미상', gender: '남성', appearance: '은빛 긴 머리와 푸른 눈. 귀 끝이 뾰족하며 손목에 희미한 문양이 있다.',
              personality: '말수가 적고 신중하지만, 신뢰하는 사람에게는 오랜 약속도 끝까지 지킨다.',
              traits: '오래된 언어를 읽을 수 있으며 비가 오기 전의 공기 변화를 잘 알아챈다.',
              additionalFields: [{ label: '종족', value: '숲의 장수종' }, { label: '소속', value: '유리숲 기록원' }, { label: '이능력', value: '물에 남아 있는 기억의 흔적을 읽는다.' }],
              backgroundStory: '기록원 깊숙한 서고에서 자신의 이름이 지워진 문서를 발견했다. 문서의 마지막 장에는 아직 일어나지 않은 사건이 기록되어 있었다.\n\n기록의 진위를 확인하기 위해 숲을 떠난 그는, 잃어버린 과거와 다가올 사건 사이의 연결을 추적하고 있다.',
            },
            '5': {
              age: '28세', gender: '여성', appearance: '검은 머리와 회색 눈. 왼쪽 귀에는 작은 통신 장치를 착용한다.',
              personality: '침착하고 책임감이 강하다. 계획이 틀어져도 동료를 먼저 살핀다.',
              traits: '작전이 끝나면 반드시 손으로 보고서를 쓴다. 오래된 라디오를 수리하는 것이 취미다.',
              additionalFields: [{ label: '코드네임', value: '루멘' }, { label: '소속', value: '경계도시 제7수색대' }, { label: '개조 이력', value: '야간 시야 보조 장치 및 신경 반응 보조 장치' }],
              backgroundStory: '도시의 경계선이 무너진 밤, 귀환 명령을 거부하고 실종된 수색대원들을 찾아 나섰다. 끝내 돌아온 사람은 그 한 명뿐이었다.\n\n지금도 끊어진 통신 채널에서 동료의 신호가 들려온다. 그는 그 신호가 남긴 좌표를 따라 다시 경계 밖으로 향한다.',
            },
          };
          previewCharacterProfiles.set(card, examples[card.dataset.rarity] || examples['3']);
        }
        return previewCharacterProfiles.get(card);
      }
      function renderCharacterProfile(card) {
        const profile = getCharacterProfile(card);
        const fields = [
          { label: '이름', value: card.querySelector('.character-card-name').textContent },
          { label: '나이', value: profile.age }, { label: '성별', value: profile.gender },
          { label: '외형', value: profile.appearance }, { label: '성격', value: profile.personality },
          { label: '특징', value: profile.traits },
          ...(Array.isArray(profile.additionalFields) ? profile.additionalFields.filter(field => field && typeof field.label === 'string' && field.label.trim()) : []),
        ];
        const list = document.getElementById('character-profile-fields');
        list.replaceChildren();
        fields.forEach(field => {
          const row = document.createElement('div'); row.className = 'character-profile-field';
          const label = document.createElement('dt'); label.textContent = field.label;
          const value = document.createElement('dd'); value.textContent = field.value == null || field.value === '' ? '미상' : String(field.value);
          row.append(label, value); list.append(row);
        });
        const background = document.getElementById('character-profile-background');
        background.replaceChildren();
        const paragraphs = typeof profile.backgroundStory === 'string' && profile.backgroundStory.trim()
          ? profile.backgroundStory.split(/\n\s*\n/).filter(text => text.trim()) : ['아직 작성된 배경 이야기가 없습니다.'];
        paragraphs.forEach(text => { const paragraph = document.createElement('p'); paragraph.textContent = text; background.append(paragraph); });
      }
      const characterEquipmentTypes = [
        { id: 'weapon', name: '무기', examples: ['수련용 검', '여행자의 검'] },
        { id: 'armor', name: '갑옷', examples: ['가죽 갑옷', '수호자의 갑옷'] },
        { id: 'gloves', name: '장갑', examples: ['가죽 장갑', '정찰대 장갑'] },
        { id: 'shoes', name: '신발', examples: ['여행자 신발', '탐험가 부츠'] },
        { id: 'ring', name: '반지', examples: ['구리 반지', '은빛 반지'] },
        { id: 'necklace', name: '목걸이', examples: ['작은 펜던트', '별빛 목걸이'] },
      ];
      const characterEquipmentStatLabels = { hp: '체력', attack: '공격력', defense: '방어력', speed: '속도', critRate: '치명타 확률', critDamage: '치명타 피해', effectHit: '효과 적중', effectResist: '효과 저항' };
      // manifest.json의 세트 기획을 게임에 내장합니다. 능력치/비용은 밸런스 초안입니다.
      const characterEquipmentSets = {"silver-oath":{"name":"백은의 맹세","classId":"knight","className":"기사","bonuses":[{"pieces":2,"stats":[{"stat":"defense","value":15,"mode":"percent"}]},{"pieces":4,"stats":[{"stat":"hp","value":20,"mode":"percent"}],"special":{"trigger":"afterBasicAttack","chance":0.8,"type":"shield","target":"self","scaleStat":"defense","scale":1,"duration":1,"description":"기본 공격 후 80% 확률로 자신에게 방어력 100%만큼 보호막, 1턴"}}]},"unyielding":{"name":"불굴의 투지","classId":"warrior","className":"전사","bonuses":[{"pieces":2,"stats":[{"stat":"hp","value":15,"mode":"percent"}]},{"pieces":4,"stats":[{"stat":"defense","value":20,"mode":"percent"}],"special":{"trigger":"onBasicAttackHit","chance":0.6,"type":"taunt","target":"primaryEnemy","duration":1,"description":"기본 공격 적중 시 60% 확률로 대상 도발, 1턴"}}]},"shadow-fang":{"name":"그림자 송곳니","classId":"assassin","className":"암살자","bonuses":[{"pieces":2,"stats":[{"stat":"critRate","value":10,"mode":"percentagePoints"}]},{"pieces":4,"stats":[{"stat":"attack","value":20,"mode":"percent"}],"special":{"trigger":"onBasicAttackHit","chance":0.8,"type":"bleed","target":"primaryEnemy","scaleStat":"attack","scale":0.15,"duration":2,"tick":"targetTurnStart","description":"기본 공격 적중 시 80% 확률로 출혈, 2턴. 대상 턴 시작마다 착용자 공격력 15% 피해"}}]},"dawn-blade":{"name":"여명의 검로","classId":"swordsman","className":"검사","bonuses":[{"pieces":2,"stats":[{"stat":"attack","value":15,"mode":"percent"}]},{"pieces":4,"stats":[{"stat":"critDamage","value":20,"mode":"percentagePoints"}],"special":{"trigger":"afterBasicAttack","chance":0.8,"type":"bonusDamage","target":"primaryEnemy","scaleStat":"attack","scale":0.3,"description":"기본 공격 후 80% 확률로 같은 대상에게 공격력 30%의 추가 피해"}}]},"trackers-eye":{"name":"추적자의 눈","classId":"hunter","className":"사냥꾼","bonuses":[{"pieces":2,"stats":[{"stat":"attack","value":15,"mode":"percent"}]},{"pieces":4,"stats":[{"stat":"critRate","value":10,"mode":"percentagePoints"}],"special":{"trigger":"onBasicAttackHit","chance":0.8,"type":"defenseDown","target":"primaryEnemy","value":0.15,"duration":1,"description":"기본 공격 적중 시 80% 확률로 대상 방어력 15% 감소, 1턴"}}]},"star-record":{"name":"별의 기록","classId":"mage","className":"마법사","bonuses":[{"pieces":2,"stats":[{"stat":"attack","value":15,"mode":"percent"}]},{"pieces":4,"stats":[{"stat":"effectHit","value":15,"mode":"percentagePoints"}],"special":{"trigger":"onActiveSkillDamage","chance":0.8,"type":"speedDown","target":"eachDamagedEnemy","value":0.15,"duration":1,"description":"액티브 스킬로 피해를 준 대상마다 80% 확률로 속도 15% 감소, 1턴"}}]},"victory-plan":{"name":"승리의 수순","classId":"tactician","className":"전술가","bonuses":[{"pieces":2,"stats":[{"stat":"speed","value":10,"mode":"percent"}]},{"pieces":4,"stats":[{"stat":"effectResist","value":20,"mode":"percentagePoints"}],"special":{"trigger":"afterBasicAttack","chance":0.8,"type":"energyRecovery","target":"allAlliesIncludingSelf","value":15,"unit":"percentagePoints","roll":"onceForWholeTeam","cap":100,"description":"기본 공격 후 80% 확률로 자신을 포함한 모든 아군의 에너지 15%p 회복"}}]},"daybreak-prayer":{"name":"새벽의 기도","classId":"healer","className":"치유사","bonuses":[{"pieces":2,"stats":[{"stat":"hp","value":15,"mode":"percent"}]},{"pieces":4,"stats":[{"stat":"effectResist","value":20,"mode":"percentagePoints"}],"special":{"trigger":"ownTurnEnd","chance":0.8,"type":"heal","target":"allyWithLowestHpRatio","scaleStat":"hp","scale":0.05,"description":"자신의 턴 종료 시 80% 확률로 체력 비율이 가장 낮은 아군을 착용자 최대 체력의 5%만큼 회복"}}]},"pathfinder":{"name":"개척자의 발걸음","classId":null,"className":"공용","bonuses":[{"pieces":2,"stats":[{"stat":"hp","value":15,"mode":"percent"}]},{"pieces":4,"stats":[{"stat":"attack","value":20,"mode":"percent"}],"special":null}]},"ancient-legacy":{"name":"고대의 유산","classId":null,"className":"공용","bonuses":[{"pieces":2,"stats":[{"stat":"defense","value":15,"mode":"percent"}]},{"pieces":4,"stats":[{"stat":"effectResist","value":20,"mode":"percentagePoints"}],"special":null}]}};
      const equipmentAssetCatalog = [{"id":"silver-oath-weapon","name":"백은의 맹세 · 무기","setId":"silver-oath","classId":"knight","slot":"weapon","file":"silver-oath-weapon.png"},{"id":"silver-oath-armor","name":"백은의 맹세 · 갑옷","setId":"silver-oath","classId":"knight","slot":"armor","file":"silver-oath-armor.png"},{"id":"silver-oath-gloves","name":"백은의 맹세 · 장갑","setId":"silver-oath","classId":"knight","slot":"gloves","file":"silver-oath-gloves.png"},{"id":"silver-oath-shoes","name":"백은의 맹세 · 신발","setId":"silver-oath","classId":"knight","slot":"shoes","file":"silver-oath-shoes.png"},{"id":"silver-oath-ring","name":"백은의 맹세 · 반지","setId":"silver-oath","classId":"knight","slot":"ring","file":"silver-oath-ring.png"},{"id":"silver-oath-necklace","name":"백은의 맹세 · 목걸이","setId":"silver-oath","classId":"knight","slot":"necklace","file":"silver-oath-necklace.png"},{"id":"unyielding-weapon","name":"불굴의 투지 · 무기","setId":"unyielding","classId":"warrior","slot":"weapon","file":"unyielding-weapon.png"},{"id":"unyielding-armor","name":"불굴의 투지 · 갑옷","setId":"unyielding","classId":"warrior","slot":"armor","file":"unyielding-armor.png"},{"id":"unyielding-gloves","name":"불굴의 투지 · 장갑","setId":"unyielding","classId":"warrior","slot":"gloves","file":"unyielding-gloves.png"},{"id":"unyielding-shoes","name":"불굴의 투지 · 신발","setId":"unyielding","classId":"warrior","slot":"shoes","file":"unyielding-shoes.png"},{"id":"unyielding-ring","name":"불굴의 투지 · 반지","setId":"unyielding","classId":"warrior","slot":"ring","file":"unyielding-ring.png"},{"id":"unyielding-necklace","name":"불굴의 투지 · 목걸이","setId":"unyielding","classId":"warrior","slot":"necklace","file":"unyielding-necklace.png"},{"id":"shadow-fang-weapon","name":"그림자 송곳니 · 무기","setId":"shadow-fang","classId":"assassin","slot":"weapon","file":"shadow-fang-weapon.png"},{"id":"shadow-fang-armor","name":"그림자 송곳니 · 갑옷","setId":"shadow-fang","classId":"assassin","slot":"armor","file":"shadow-fang-armor.png"},{"id":"shadow-fang-gloves","name":"그림자 송곳니 · 장갑","setId":"shadow-fang","classId":"assassin","slot":"gloves","file":"shadow-fang-gloves.png"},{"id":"shadow-fang-shoes","name":"그림자 송곳니 · 신발","setId":"shadow-fang","classId":"assassin","slot":"shoes","file":"shadow-fang-shoes.png"},{"id":"shadow-fang-ring","name":"그림자 송곳니 · 반지","setId":"shadow-fang","classId":"assassin","slot":"ring","file":"shadow-fang-ring.png"},{"id":"shadow-fang-necklace","name":"그림자 송곳니 · 목걸이","setId":"shadow-fang","classId":"assassin","slot":"necklace","file":"shadow-fang-necklace.png"},{"id":"dawn-blade-weapon","name":"여명의 검로 · 무기","setId":"dawn-blade","classId":"swordsman","slot":"weapon","file":"dawn-blade-weapon.png"},{"id":"dawn-blade-armor","name":"여명의 검로 · 갑옷","setId":"dawn-blade","classId":"swordsman","slot":"armor","file":"dawn-blade-armor.png"},{"id":"dawn-blade-gloves","name":"여명의 검로 · 장갑","setId":"dawn-blade","classId":"swordsman","slot":"gloves","file":"dawn-blade-gloves.png"},{"id":"dawn-blade-shoes","name":"여명의 검로 · 신발","setId":"dawn-blade","classId":"swordsman","slot":"shoes","file":"dawn-blade-shoes.png"},{"id":"dawn-blade-ring","name":"여명의 검로 · 반지","setId":"dawn-blade","classId":"swordsman","slot":"ring","file":"dawn-blade-ring.png"},{"id":"dawn-blade-necklace","name":"여명의 검로 · 목걸이","setId":"dawn-blade","classId":"swordsman","slot":"necklace","file":"dawn-blade-necklace.png"},{"id":"trackers-eye-weapon","name":"추적자의 눈 · 무기","setId":"trackers-eye","classId":"hunter","slot":"weapon","file":"trackers-eye-weapon.png"},{"id":"trackers-eye-armor","name":"추적자의 눈 · 갑옷","setId":"trackers-eye","classId":"hunter","slot":"armor","file":"trackers-eye-armor.png"},{"id":"trackers-eye-gloves","name":"추적자의 눈 · 장갑","setId":"trackers-eye","classId":"hunter","slot":"gloves","file":"trackers-eye-gloves.png"},{"id":"trackers-eye-shoes","name":"추적자의 눈 · 신발","setId":"trackers-eye","classId":"hunter","slot":"shoes","file":"trackers-eye-shoes.png"},{"id":"trackers-eye-ring","name":"추적자의 눈 · 반지","setId":"trackers-eye","classId":"hunter","slot":"ring","file":"trackers-eye-ring.png"},{"id":"trackers-eye-necklace","name":"추적자의 눈 · 목걸이","setId":"trackers-eye","classId":"hunter","slot":"necklace","file":"trackers-eye-necklace.png"},{"id":"star-record-weapon","name":"별의 기록 · 무기","setId":"star-record","classId":"mage","slot":"weapon","file":"star-record-weapon.png"},{"id":"star-record-armor","name":"별의 기록 · 갑옷","setId":"star-record","classId":"mage","slot":"armor","file":"star-record-armor.png"},{"id":"star-record-gloves","name":"별의 기록 · 장갑","setId":"star-record","classId":"mage","slot":"gloves","file":"star-record-gloves.png"},{"id":"star-record-shoes","name":"별의 기록 · 신발","setId":"star-record","classId":"mage","slot":"shoes","file":"star-record-shoes.png"},{"id":"star-record-ring","name":"별의 기록 · 반지","setId":"star-record","classId":"mage","slot":"ring","file":"star-record-ring.png"},{"id":"star-record-necklace","name":"별의 기록 · 목걸이","setId":"star-record","classId":"mage","slot":"necklace","file":"star-record-necklace.png"},{"id":"victory-plan-weapon","name":"승리의 수순 · 무기","setId":"victory-plan","classId":"tactician","slot":"weapon","file":"victory-plan-weapon.png"},{"id":"victory-plan-armor","name":"승리의 수순 · 갑옷","setId":"victory-plan","classId":"tactician","slot":"armor","file":"victory-plan-armor.png"},{"id":"victory-plan-gloves","name":"승리의 수순 · 장갑","setId":"victory-plan","classId":"tactician","slot":"gloves","file":"victory-plan-gloves.png"},{"id":"victory-plan-shoes","name":"승리의 수순 · 신발","setId":"victory-plan","classId":"tactician","slot":"shoes","file":"victory-plan-shoes.png"},{"id":"victory-plan-ring","name":"승리의 수순 · 반지","setId":"victory-plan","classId":"tactician","slot":"ring","file":"victory-plan-ring.png"},{"id":"victory-plan-necklace","name":"승리의 수순 · 목걸이","setId":"victory-plan","classId":"tactician","slot":"necklace","file":"victory-plan-necklace.png"},{"id":"daybreak-prayer-weapon","name":"새벽의 기도 · 무기","setId":"daybreak-prayer","classId":"healer","slot":"weapon","file":"daybreak-prayer-weapon.png"},{"id":"daybreak-prayer-armor","name":"새벽의 기도 · 갑옷","setId":"daybreak-prayer","classId":"healer","slot":"armor","file":"daybreak-prayer-armor.png"},{"id":"daybreak-prayer-gloves","name":"새벽의 기도 · 장갑","setId":"daybreak-prayer","classId":"healer","slot":"gloves","file":"daybreak-prayer-gloves.png"},{"id":"daybreak-prayer-shoes","name":"새벽의 기도 · 신발","setId":"daybreak-prayer","classId":"healer","slot":"shoes","file":"daybreak-prayer-shoes.png"},{"id":"daybreak-prayer-ring","name":"새벽의 기도 · 반지","setId":"daybreak-prayer","classId":"healer","slot":"ring","file":"daybreak-prayer-ring.png"},{"id":"daybreak-prayer-necklace","name":"새벽의 기도 · 목걸이","setId":"daybreak-prayer","classId":"healer","slot":"necklace","file":"daybreak-prayer-necklace.png"},{"id":"pathfinder-weapon","name":"개척자의 발걸음 · 무기","setId":"pathfinder","classId":null,"slot":"weapon","file":"pathfinder-weapon.png"},{"id":"pathfinder-armor","name":"개척자의 발걸음 · 갑옷","setId":"pathfinder","classId":null,"slot":"armor","file":"pathfinder-armor.png"},{"id":"pathfinder-gloves","name":"개척자의 발걸음 · 장갑","setId":"pathfinder","classId":null,"slot":"gloves","file":"pathfinder-gloves.png"},{"id":"pathfinder-shoes","name":"개척자의 발걸음 · 신발","setId":"pathfinder","classId":null,"slot":"shoes","file":"pathfinder-shoes.png"},{"id":"pathfinder-ring","name":"개척자의 발걸음 · 반지","setId":"pathfinder","classId":null,"slot":"ring","file":"pathfinder-ring.png"},{"id":"pathfinder-necklace","name":"개척자의 발걸음 · 목걸이","setId":"pathfinder","classId":null,"slot":"necklace","file":"pathfinder-necklace.png"},{"id":"ancient-legacy-weapon","name":"고대의 유산 · 무기","setId":"ancient-legacy","classId":null,"slot":"weapon","file":"ancient-legacy-weapon.png"},{"id":"ancient-legacy-armor","name":"고대의 유산 · 갑옷","setId":"ancient-legacy","classId":null,"slot":"armor","file":"ancient-legacy-armor.png"},{"id":"ancient-legacy-gloves","name":"고대의 유산 · 장갑","setId":"ancient-legacy","classId":null,"slot":"gloves","file":"ancient-legacy-gloves.png"},{"id":"ancient-legacy-shoes","name":"고대의 유산 · 신발","setId":"ancient-legacy","classId":null,"slot":"shoes","file":"ancient-legacy-shoes.png"},{"id":"ancient-legacy-ring","name":"고대의 유산 · 반지","setId":"ancient-legacy","classId":null,"slot":"ring","file":"ancient-legacy-ring.png"},{"id":"ancient-legacy-necklace","name":"고대의 유산 · 목걸이","setId":"ancient-legacy","classId":null,"slot":"necklace","file":"ancient-legacy-necklace.png"}];
      let previewEquipmentInventory;
      function original_getPreviewEquipmentInventory() {
        if (!previewEquipmentInventory) previewEquipmentInventory = equipmentAssetCatalog.map((asset, index) => {
          const [key, value] = Object.entries({ weapon: { attack: 40 }, armor: { hp: 300 }, gloves: { attack: 20 }, shoes: { speed: 5 }, ring: { defense: 20 }, necklace: { hp: 150 } }[asset.slot])[0];
          const rarity = 3 + Math.floor(index / 6) % 3;
          const subKeys = Object.keys(equipmentEnhancementRules.gains).filter(option => option !== key).slice(0, rarity - 2);
          return refreshEquipmentOptionStats({ id: asset.id, name: asset.name, type: asset.slot, classId: asset.classId, setId: asset.setId,
            image: 'assets/equipment/' + asset.file, rarity, enhancement: 0,
            mainOption: { key, value: Math.round(value * (1 + (rarity - 3) * .25)) },
            subOptions: subKeys.map(key => ({ key, value: equipmentEnhancementRules.gains[key] })) });
        });
        return previewEquipmentInventory;
      }
      function canEquipCharacterEquipment(card, item) {
        if (!card || !item) return false;
        const set = characterEquipmentSets[item.setId];
        return Boolean(set && (!set.classId || getCharacterBaseStats(card).role === set.className));
      }
      function describeEquipmentSetBonus(bonus) {
        const stats = bonus.stats.map(effect => characterEquipmentStatLabels[effect.stat] + ' +' + effect.value + '%').join(' · ');
        return stats + (bonus.special ? ' · ' + bonus.special.description : '');
      }
      // 전투 구현 시 스킬과 별도 판정할 특수 효과. 6개 착용해도 4세트 효과는 한 번만 제공합니다.
      function getCharacterEquipmentSpecialEffects(card, equipmentState) {
        const state = equipmentState || getCharacterEquipment(card), counts = getCharacterEquipmentSetCounts(state);
        return Object.entries(characterEquipmentSets).flatMap(([id, set]) => set.bonuses
          .filter(bonus => bonus.special && (counts[id] || 0) >= bonus.pieces)
          .map(bonus => ({ ...bonus.special, setId: id })));
      }
      function describeEquipmentStats(stats) {
        return Object.entries(stats).map(([key, value]) => characterEquipmentStatLabels[key] + ' +' + value.toLocaleString('ko-KR') + (['critRate', 'critDamage', 'effectHit', 'effectResist'].includes(key) ? '%' : '')).join(' · ');
      }
      // 화면 확인용 비용·증가량입니다. 최대 단계와 3단계 주기는 사용자 규칙입니다.
      const equipmentEnhancementRules = {
        maxLevel: 15, milestone: 3, maxSubOptions: 4,
        goldCost: nextLevel => nextLevel * 100,
        gains: { hp: 50, attack: 5, defense: 5, speed: 1, critRate: 1, critDamage: 2, effectHit: 2, effectResist: 2 },
      };
      function refreshEquipmentOptionStats(item) {
        const stats = { [item.mainOption.key]: item.mainOption.value };
        item.subOptions.forEach(option => { stats[option.key] = (stats[option.key] || 0) + option.value; });
        item.stats = stats;
        return item;
      }
      function equipmentDisplayName(item) { return item.name + ' +' + item.enhancement; }
      function getEquipmentRarity(item) { return [3, 4, 5].includes(Number(item.rarity)) ? Number(item.rarity) : 3; }
      function applyEquipmentRarity(element, item) {
        const rarity = getEquipmentRarity(item);
        element.dataset.rarity = rarity;
        element.style.setProperty('--equipment-rarity-color', { 3: '#858b95', 4: '#b18ae5', 5: '#e8c56c' }[rarity]);
      }
      function createEquipmentStars(item) {
        const stars = document.createElement('span'); stars.className = 'equipment-rarity-stars'; stars.setAttribute('role', 'img'); stars.setAttribute('aria-label', getEquipmentRarity(item) + '성');
        for (let index = 0; index < getEquipmentRarity(item); index++) {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'currentColor'); svg.setAttribute('aria-hidden', 'true');
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'm12 2 3.1 6.3L22 9.3l-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1Z'); svg.append(path); stars.append(svg);
        }
        return stars;
      }
      function describeEquipmentOptions(item) {
        return '주 옵션: ' + describeEquipmentStats({ [item.mainOption.key]: item.mainOption.value }) + '\n서브 옵션 (' + item.subOptions.length + '/4)\n' + item.subOptions.map(option => describeEquipmentStats({ [option.key]: option.value })).join('\n');
      }
      function equipmentStatValue(key, value) {
        return value.toLocaleString('ko-KR') + (['critRate', 'critDamage', 'effectHit', 'effectResist'].includes(key) ? '%' : '');
      }
      function createEquipmentSheet(item, enhancement = false) {
        const sheet = document.createElement('div'); sheet.className = 'equipment-sheet';
        applyEquipmentRarity(sheet, item);
        const heading = document.createElement('div'); heading.className = 'equipment-sheet-heading';
        const name = document.createElement('h3'); name.className = 'equipment-sheet-name'; name.textContent = item.name; heading.append(name, createEquipmentStars(item)); sheet.append(heading);
        const maxed = item.enhancement >= equipmentEnhancementRules.maxLevel;
        if (enhancement) {
          const level = document.createElement('div'); level.className = 'equipment-sheet-level';
          const label = document.createElement('span'); label.textContent = '강화 단계';
          const value = document.createElement('strong'); value.textContent = '+' + item.enhancement + (maxed ? ' · MAX' : '  →  +' + (item.enhancement + 1)); level.append(label, value); sheet.append(level);
        }
        const main = document.createElement('div'); main.className = 'equipment-sheet-main';
        const icon = document.createElement('div'); icon.className = 'equipment-sheet-icon';
        const stage = document.createElement('span'); stage.textContent = '+' + item.enhancement;
        icon.append(createEquipmentIcon(item), stage);
        const primary = document.createElement('div');
        const label = document.createElement('span'); label.className = 'equipment-sheet-primary-label'; label.textContent = '주 옵션 · ' + characterEquipmentStatLabels[item.mainOption.key];
        const value = document.createElement('strong'); value.className = 'equipment-sheet-primary-value';
        value.textContent = equipmentStatValue(item.mainOption.key, item.mainOption.value) + (enhancement && !maxed ? ' → ' + equipmentStatValue(item.mainOption.key, item.mainOption.value + equipmentEnhancementRules.gains[item.mainOption.key]) : '');
        const max = document.createElement('span'); max.className = 'equipment-sheet-primary-max';
        max.textContent = 'MAX ' + equipmentStatValue(item.mainOption.key, item.mainOption.value + Math.max(0, equipmentEnhancementRules.maxLevel - item.enhancement) * equipmentEnhancementRules.gains[item.mainOption.key]);
        primary.append(label, value, max); main.append(icon, primary); sheet.append(main);
        const substats = document.createElement('dl'); substats.className = 'equipment-sheet-substats'; substats.setAttribute('aria-label', '서브 옵션');
        item.subOptions.forEach(option => {
          const row = document.createElement('div'); const label = document.createElement('dt'); label.textContent = characterEquipmentStatLabels[option.key];
          const value = document.createElement('dd'); value.textContent = equipmentStatValue(option.key, option.value); row.append(label, value); substats.append(row);
        });
        sheet.append(substats);
        if (enhancement && !maxed) {
          const hint = document.createElement('div'); hint.className = 'equipment-sheet-next';
          const nextLevel = item.enhancement + 1;
          hint.textContent = nextLevel % equipmentEnhancementRules.milestone === 0
            ? item.subOptions.length < 4 ? '이번 강화: 서브 옵션 1개 추가' : '이번 강화: 서브 옵션 1개 무작위 증가'
            : '다음 서브 옵션 변화: +' + (Math.ceil(nextLevel / 3) * 3);
          sheet.append(hint);
        }
        const set = characterEquipmentSets[item.setId];
        const setBox = document.createElement('div'); setBox.className = 'equipment-sheet-set';
        const setName = document.createElement('strong'); setName.textContent = set.name + ' · ' + (set.className ? set.className + ' 전용' : '공용'); setBox.append(setName);
        set.bonuses.forEach(bonus => { const effect = document.createElement('span'); effect.textContent = bonus.pieces + '세트 · ' + describeEquipmentSetBonus(bonus); setBox.append(effect); });
        sheet.append(setBox); return sheet;
      }
      function calculateEquipmentEnhancement(item, gold, rules = equipmentEnhancementRules, random = Math.random) {
        if (item.enhancement >= rules.maxLevel) return { ok: false, message: '최대 강화 단계입니다.' };
        const nextLevel = item.enhancement + 1;
        const cost = rules.goldCost(nextLevel);
        if (!Number.isFinite(cost) || cost < 0) return { ok: false, message: '강화 비용을 확인해 주세요.' };
        if (gold < cost) return { ok: false, message: '골드가 부족합니다.' };
        const next = { ...item, enhancement: nextLevel, mainOption: { ...item.mainOption }, subOptions: item.subOptions.map(option => ({ ...option })) };
        next.mainOption.value += rules.gains[next.mainOption.key];
        let event = '주 옵션이 증가했습니다.';
        const choose = length => Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
        if (nextLevel % rules.milestone === 0) {
          if (next.subOptions.length < rules.maxSubOptions) {
            const pool = Object.keys(rules.gains).filter(key => key !== next.mainOption.key && !next.subOptions.some(option => option.key === key));
            const key = pool[choose(pool.length)];
            next.subOptions.push({ key, value: rules.gains[key] });
            event += '\n서브 옵션 추가: ' + characterEquipmentStatLabels[key];
          } else {
            const option = next.subOptions[choose(next.subOptions.length)];
            option.value += rules.gains[option.key];
            event += '\n서브 옵션 강화: ' + characterEquipmentStatLabels[option.key];
          }
        }
        refreshEquipmentOptionStats(next);
        return { ok: true, item: next, gold: gold - cost, cost, message: event };
      }
      function getCharacterEquipmentSetCounts(state) {
        const counts = {};
        Object.values(state.equipped).forEach(id => { const item = state.items.find(item => item.id === id); if (item?.setId) counts[item.setId] = (counts[item.setId] || 0) + 1; });
        return counts;
      }
      function original_getCharacterEquipmentTotalStats(card, equipmentState) {
        const base = getCharacterBaseStats(card), total = { ...base };
        const state = equipmentState || getCharacterEquipment(card);
        Object.values(state.equipped).forEach(id => {
          const item = state.items.find(item => item.id === id);
          if (item) Object.entries(item.stats).forEach(([key, value]) => { total[key] += value; });
        });
        const counts = getCharacterEquipmentSetCounts(state);
        // 비율 보너스는 장비 옵션을 더하기 전 기본 스탯 기준이며 서로 곱하지 않습니다.
        const percentageBonuses = {};
        Object.entries(characterEquipmentSets).forEach(([id, set]) => set.bonuses.forEach(bonus => {
          if ((counts[id] || 0) < bonus.pieces) return;
          bonus.stats.forEach(effect => {
            if (effect.mode === 'percent') percentageBonuses[effect.stat] = (percentageBonuses[effect.stat] || 0) + effect.value;
            else total[effect.stat] += effect.value;
          });
        }));
        Object.entries(percentageBonuses).forEach(([key, percent]) => { total[key] += Math.round(base[key] * percent / 100); });
        return total;
      }
      function original_getCharacterEquipment(card) {
        if (!previewCharacterEquipment.has(card)) previewCharacterEquipment.set(card, {
          selectedType: 'weapon', equipped: {}, items: getPreviewEquipmentInventory(),
        });
        return previewCharacterEquipment.get(card);
      }
      function openEquipmentEnhancement(itemId, returnView) {
        if (!selectedCharacterCard) return;
        const state = getCharacterEquipment(selectedCharacterCard);
        const item = state.items.find(item => item.id === itemId);
        if (!item) return;
        equipmentEnhancementTarget = { card: selectedCharacterCard, itemId, returnView };
        renderEquipmentEnhancement();
        showGameView('equipment-enhancement');
        document.querySelector('.equipment-enhancement-body').scrollTop = 0;
        document.getElementById('equipment-enhancement-back').focus({ preventScroll: true });
      }
      function renderEquipmentEnhancement(message = '') {
        if (!equipmentEnhancementTarget) return;
        const { card, itemId } = equipmentEnhancementTarget;
        const item = getCharacterEquipment(card).items.find(item => item.id === itemId);
        const maxed = item.enhancement >= equipmentEnhancementRules.maxLevel;
        const nextLevel = item.enhancement + 1;
        const cost = maxed ? 0 : equipmentEnhancementRules.goldCost(nextLevel);
        document.getElementById('equipment-enhancement-title').textContent = equipmentDisplayName(item) + ' · 강화';
        document.getElementById('equipment-enhancement-details').replaceChildren(createEquipmentSheet(item, true));
        const emblem = document.getElementById('equipment-enhancement-emblem'); emblem.replaceChildren();
        const level = document.createElement('strong'); level.textContent = '+' + item.enhancement; emblem.append(createEquipmentIcon(item), level);
        document.getElementById('equipment-enhancement-cost').textContent = '보유 골드 ' + previewGameWallet.gold.toLocaleString('ko-KR') + (maxed ? '' : '\n강화 비용 ' + cost.toLocaleString('ko-KR') + ' 골드');
        const button = document.getElementById('equipment-enhancement-confirm');
        button.disabled = maxed || previewGameWallet.gold < cost;
        button.textContent = maxed ? '최대 강화' : '강화';
        const status = document.getElementById('equipment-enhancement-status');
        status.dataset.state = !maxed && previewGameWallet.gold < cost ? 'error' : 'normal';
        status.textContent = message || (maxed ? '최대 강화 단계입니다.' : previewGameWallet.gold < cost ? '골드가 부족합니다.' : '비용과 옵션 증가량은 현재 임시 수치입니다.');
      }
      document.getElementById('equipment-enhance-selected').addEventListener('click', () => {
        if (selectedCharacterCard) openEquipmentEnhancement(getCharacterEquipment(selectedCharacterCard).selectedItemId, 'equipment-picker');
      });
      document.getElementById('equipment-enhancement-confirm').addEventListener('click', () => {
        if (!equipmentEnhancementTarget) return;
        const { card, itemId } = equipmentEnhancementTarget;
        const state = getCharacterEquipment(card);
        const index = state.items.findIndex(item => item.id === itemId);
        if (index < 0) return;
        const result = calculateEquipmentEnhancement(state.items[index], previewGameWallet.gold);
        if (!result.ok) { renderEquipmentEnhancement(result.message); return; }
        state.items[index] = result.item;
        previewGameWallet.gold = result.gold;
        const gold = document.getElementById('game-gold'); gold.textContent = result.gold.toLocaleString('ko-KR'); gold.parentElement.setAttribute('aria-label', '골드 ' + result.gold.toLocaleString('ko-KR'));
        renderCharacterEquipment(card); renderCharacterInfo(card); renderEquipmentEnhancement('+' + result.item.enhancement + ' 강화 완료\n' + result.message);
      });
      document.getElementById('equipment-enhancement-back').addEventListener('click', () => {
        if (!equipmentEnhancementTarget) return;
        const { card, returnView } = equipmentEnhancementTarget;
        equipmentEnhancementTarget = null;
        if (returnView === 'equipment-picker') {
          renderCharacterEquipmentPicker(card); showGameView('equipment-picker');
          document.getElementById('character-equipment-back').focus({ preventScroll: true });
        } else returnFromEquipmentPicker();
      });
      function renderCharacterEquipment(card) {
        const state = getCharacterEquipment(card);
        const slots = document.getElementById('character-equipment-slots'); slots.replaceChildren();
        characterEquipmentTypes.forEach(type => {
          const item = state.items.find(item => item.id === state.equipped[type.id]);
          const button = document.createElement('button'); button.type = 'button'; button.className = 'character-equipment-slot'; button.dataset.equipmentType = type.id;
          button.setAttribute('aria-label', type.name + ' · ' + (item ? equipmentDisplayName(item) + ' · ' + getEquipmentRarity(item) + '성' : '미장착') + (item ? ' · 우클릭으로 강화, 교체 또는 해제' : ' · 클릭하여 장착'));
          if (item) button.setAttribute('aria-haspopup', 'menu');
          const name = document.createElement('strong'); name.textContent = type.name;
          const equipped = document.createElement('span'); equipped.className = 'equipment-slot-content';
          if (item) {
            const caption = document.createElement('span'); caption.textContent = equipmentDisplayName(item);
            equipped.append(createEquipmentIcon(item), caption);
          } else equipped.textContent = '미장착';
          button.append(name, equipped);
          if (item) { applyEquipmentRarity(button, item); button.append(createEquipmentStars(item)); }
          slots.append(button);
        });
        const stats = document.getElementById('character-equipment-stats'); stats.replaceChildren();
        const total = getCharacterEquipmentTotalStats(card);
        const base = getCharacterBaseStats(card);
        Object.entries(characterEquipmentStatLabels).forEach(([key, label]) => {
          const row = document.createElement('div'); const name = document.createElement('dt'); name.textContent = label;
          const unit = ['critRate', 'critDamage', 'effectHit', 'effectResist'].includes(key) ? '%' : '';
          const value = document.createElement('dd'); value.textContent = base[key].toLocaleString('ko-KR') + unit;
          const bonus = document.createElement('span'); bonus.className = 'character-equipment-stat-bonus';
          const increase = total[key] - base[key];
          bonus.textContent = '(' + (increase >= 0 ? '+' : '') + increase.toLocaleString('ko-KR') + unit + ')';
          value.append(bonus);
          row.append(name, value); stats.append(row);
        });
        const sets = document.getElementById('character-equipment-sets'); sets.replaceChildren();
        const counts = getCharacterEquipmentSetCounts(state);
        Object.entries(characterEquipmentSets).forEach(([id, set]) => {
          const count = counts[id] || 0;
          const activeBonuses = set.bonuses.filter(bonus => count >= bonus.pieces);
          if (count < 2 || !activeBonuses.length) return;
          const slot = document.createElement('div'); slot.className = 'character-equipment-set-slot'; slot.dataset.setId = id;
          const heading = document.createElement('strong'); heading.textContent = set.name + ' · ' + count + '개'; slot.append(heading);
          activeBonuses.forEach(bonus => {
            const effect = document.createElement('p'); effect.className = 'character-equipment-set'; effect.dataset.active = 'true';
            effect.textContent = bonus.pieces + '세트: ' + describeEquipmentSetBonus({ ...bonus, special: null }); slot.append(effect);
            if (bonus.special) {
              const special = document.createElement('p'); special.className = 'character-equipment-set'; special.dataset.active = 'true';
              special.textContent = bonus.special.description; special.title = bonus.special.description; slot.append(special);
            }
          });
          sets.append(slot);
        });
        while (sets.children.length < 3) { const empty = document.createElement('div'); empty.className = 'character-equipment-set-slot'; empty.setAttribute('aria-label', '빈 세트 효과 칸'); sets.append(empty); }
      }
      function createEquipmentIcon(equipment) {
        const type = typeof equipment === 'string' ? equipment : equipment.type;
        if (typeof equipment === 'object' && equipment.image) {
          const icon = document.createElement('span'); icon.className = 'character-equipment-icon'; icon.setAttribute('aria-hidden', 'true');
          const image = document.createElement('img'); image.src = equipment.image; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
          icon.append(image); return icon;
        }
        const paths = {
          weapon: 'M14 3h7v7L10 21l-7-7L14 3Zm-8 8 7 7M3 21l4-4',
          armor: 'm8 3-5 4 3 5 2-2v11h8V10l2 2 3-5-5-4c0 4-8 4-8 0Z',
          gloves: 'M7 12V7a1.5 1.5 0 0 1 3 0v4-7a1.5 1.5 0 0 1 3 0v7-6a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v8c0 4-3 6-7 6H9l-6-7a1.5 1.5 0 0 1 2-2l2 2Z',
          shoes: 'M8 3h8v10l5 3v5H3v-6l5-2V3Zm0 5h8M4 17h16',
          ring: 'm12 2 4 4-4 4-4-4 4-4ZM8 10a7 7 0 1 0 8 0',
          necklace: 'M4 3c0 8 3 13 8 15 5-2 8-7 8-15M12 15l4 4-4 4-4-4 4-4Z',
        };
        const icon = document.createElement('span'); icon.className = 'character-equipment-icon'; icon.setAttribute('aria-hidden', 'true');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.3'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', paths[type] || paths.weapon); svg.append(path); icon.append(svg); return icon;
      }
      function renderCharacterEquipmentPicker(card) {
        const state = getCharacterEquipment(card);
        const type = characterEquipmentTypes.find(type => type.id === state.selectedType);
        document.getElementById('character-equipment-list-title').textContent = '보유 ' + type.name;
        const list = document.getElementById('character-equipment-list'); list.replaceChildren();
        const items = state.items.filter(item => item.type === state.selectedType && canEquipCharacterEquipment(card, item));
        items.forEach(item => {
          const equipped = state.equipped[item.type] === item.id;
          const row = document.createElement('button'); row.type = 'button'; row.className = 'character-equipment-item character-equipment-choice'; row.dataset.equipmentId = item.id; row.dataset.equipped = String(equipped);
          applyEquipmentRarity(row, item);
          row.setAttribute('aria-pressed', String(state.selectedItemId === item.id));
          row.setAttribute('aria-label', item.name + ' · ' + getEquipmentRarity(item) + '성' + (equipped ? ' · 장착 중' : ''));
          const name = document.createElement('strong'); name.textContent = equipmentDisplayName(item);
          row.append(createEquipmentIcon(item), name, createEquipmentStars(item)); list.append(row);
        });
        if (!items.length) { const empty = document.createElement('p'); empty.className = 'character-awakening-note'; empty.textContent = '보유한 ' + type.name + ' 장비가 없습니다.'; list.append(empty); }
        renderSelectedEquipment(card);
      }
      function equipCharacterEquipment(card, itemId) {
        if (!card) return false;
        const state = getCharacterEquipment(card);
        const item = state.items.find(item => item.id === itemId);
        if (!item || !characterEquipmentTypes.some(type => type.id === item.type) || !canEquipCharacterEquipment(card, item)) return false;
        // 장비 인스턴스 하나를 여러 캐릭터가 함께 착용할 수 없습니다.
        document.querySelectorAll('#characters-screen .character-portrait-card').forEach(other => {
          if (other === card) return;
          const otherState = getCharacterEquipment(other);
          if (otherState.equipped[item.type] === item.id) delete otherState.equipped[item.type];
        });
        state.equipped[item.type] = item.id;
        if (card === selectedCharacterCard) { renderCharacterEquipment(card); renderCharacterInfo(card); }
        return true;
      }
      document.getElementById('character-equipment-slots').addEventListener('click', event => {
        const button = event.target.closest('[data-equipment-type]'); if (!button || !selectedCharacterCard) return;
        const state = getCharacterEquipment(selectedCharacterCard);
        if (!state.equipped[button.dataset.equipmentType]) openEquipmentPicker(button.dataset.equipmentType);
      });
      document.getElementById('character-equipment-list').addEventListener('click', event => {
        const button = event.target.closest('[data-equipment-id]');
        if (!button || !selectedCharacterCard) return;
        const state = getCharacterEquipment(selectedCharacterCard);
        const item = state.items.find(item => item.id === button.dataset.equipmentId && item.type === state.selectedType);
        if (!item) return;
        state.selectedItemId = item.id;
        document.querySelectorAll('.character-equipment-choice').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
        renderSelectedEquipment(selectedCharacterCard);
      });
      document.getElementById('equipment-confirm').addEventListener('click', () => {
        if (!selectedCharacterCard) return;
        const state = getCharacterEquipment(selectedCharacterCard);
        const item = state.items.find(item => item.id === state.selectedItemId && item.type === state.selectedType);
        if (item && equipCharacterEquipment(selectedCharacterCard, item.id)) returnFromEquipmentPicker();
      });
      document.getElementById('character-equipment-back').addEventListener('click', returnFromEquipmentPicker);
      function openEquipmentPicker(type) {
        if (!selectedCharacterCard || !characterEquipmentTypes.some(item => item.id === type)) return;
        const state = getCharacterEquipment(selectedCharacterCard); state.selectedType = type;
        state.selectedItemId = null;
        renderCharacterEquipmentPicker(selectedCharacterCard);
        showGameView('equipment-picker');
        document.querySelector('.equipment-picker-list-pane').scrollTop = 0;
        document.querySelector('.equipment-comparison').scrollTop = 0;
        document.getElementById('character-equipment-back').focus({ preventScroll: true });
      }
      function returnFromEquipmentPicker() {
        showGameView('character-detail');
        selectCharacterTab(document.getElementById('character-tab-equipment'));
        const type = getCharacterEquipment(selectedCharacterCard).selectedType;
        document.querySelectorAll('[data-equipment-type]').forEach(slot => { if (slot.dataset.equipmentType === type) slot.focus({ preventScroll: true }); });
      }
      function renderSelectedEquipment(card) {
        const state = getCharacterEquipment(card);
        const current = state.items.find(item => item.id === state.equipped[state.selectedType]);
        const selected = state.items.find(item => item.id === state.selectedItemId && item.type === state.selectedType);
        const box = document.getElementById('equipment-selected-details'); box.replaceChildren();
        box.setAttribute('aria-label', selected ? selected.name + ' 정보' : '장비 정보');
        if (selected) box.append(createEquipmentSheet(selected));
        else { const hint = document.createElement('p'); hint.textContent = '장비를 선택하세요.'; box.append(hint); }
        const confirm = document.getElementById('equipment-confirm');
        document.getElementById('equipment-enhance-selected').disabled = !selected || selected.enhancement >= equipmentEnhancementRules.maxLevel;
        confirm.disabled = !selected || !canEquipCharacterEquipment(card, selected) || selected.id === current?.id;
        confirm.textContent = selected && selected.id === current?.id ? '장착 중' : current ? '교체' : '장착';
      }
      function hideEquipmentOverlays() {
        document.getElementById('equipment-hover').hidden = true;
        document.getElementById('equipment-context-menu').hidden = true;
        document.querySelectorAll('[data-equipment-type]').forEach(slot => slot.removeAttribute('aria-describedby'));
      }
      function placeEquipmentOverlay(overlay, x, y) {
        overlay.style.left = '12px'; overlay.style.top = '12px'; overlay.hidden = false;
        const rect = overlay.getBoundingClientRect();
        overlay.style.left = Math.max(12, Math.min(x, window.innerWidth - rect.width - 12)) + 'px';
        overlay.style.top = Math.max(12, Math.min(y, window.innerHeight - rect.height - 12)) + 'px';
      }
      function showEquipmentTooltip(slot) {
        if (!selectedCharacterCard || !document.getElementById('equipment-context-menu').hidden) return;
        const state = getCharacterEquipment(selectedCharacterCard);
        const item = state.items.find(item => item.id === state.equipped[slot.dataset.equipmentType]);
        if (!item) return;
        const box = document.getElementById('equipment-hover'); box.replaceChildren(createEquipmentSheet(item));
        const rect = slot.getBoundingClientRect(); placeEquipmentOverlay(box, rect.right + 10, rect.top);
        slot.setAttribute('aria-describedby', 'equipment-hover');
      }
      function showEquipmentContextMenu(slot, x, y) {
        if (!selectedCharacterCard) return;
        const state = getCharacterEquipment(selectedCharacterCard);
        if (!state.equipped[slot.dataset.equipmentType]) return;
        hideEquipmentOverlays(); const menu = document.getElementById('equipment-context-menu'); menu.dataset.type = slot.dataset.equipmentType;
        placeEquipmentOverlay(menu, x, y); menu.querySelector('button').focus({ preventScroll: true });
      }
      document.getElementById('character-equipment-slots').addEventListener('pointerover', event => {
        const slot = event.target.closest('[data-equipment-type]'); if (slot && !slot.contains(event.relatedTarget)) showEquipmentTooltip(slot);
      });
      document.getElementById('character-equipment-slots').addEventListener('pointerout', event => {
        const slot = event.target.closest('[data-equipment-type]'); if (slot && !slot.contains(event.relatedTarget)) { document.getElementById('equipment-hover').hidden = true; slot.removeAttribute('aria-describedby'); }
      });
      document.getElementById('character-equipment-slots').addEventListener('contextmenu', event => {
        const slot = event.target.closest('[data-equipment-type]'); if (!slot) return;
        event.preventDefault(); const rect = slot.getBoundingClientRect(); showEquipmentContextMenu(slot, event.clientX || rect.left, event.clientY || rect.bottom);
      });
      document.getElementById('character-equipment-slots').addEventListener('keydown', event => {
        const slot = event.target.closest('[data-equipment-type]'); if (!slot) return;
        if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10') || event.key === 'Enter' || event.key === ' ') {
          if (!selectedCharacterCard || !getCharacterEquipment(selectedCharacterCard).equipped[slot.dataset.equipmentType]) return;
          event.preventDefault(); const rect = slot.getBoundingClientRect(); showEquipmentContextMenu(slot, rect.left, rect.bottom);
        }
      });
      document.getElementById('equipment-context-menu').addEventListener('click', event => {
        const action = event.target.closest('[data-equipment-action]'); if (!action || !selectedCharacterCard) return;
        const type = event.currentTarget.dataset.type; hideEquipmentOverlays();
        if (action.dataset.equipmentAction === 'replace') openEquipmentPicker(type);
        else if (action.dataset.equipmentAction === 'enhance') {
          const state = getCharacterEquipment(selectedCharacterCard); openEquipmentEnhancement(state.equipped[type], 'character-detail');
        }
        else {
          const state = getCharacterEquipment(selectedCharacterCard); delete state.equipped[type]; renderCharacterEquipment(selectedCharacterCard); renderCharacterInfo(selectedCharacterCard);
          document.querySelectorAll('[data-equipment-type]').forEach(slot => { if (slot.dataset.equipmentType === type) slot.focus({ preventScroll: true }); });
        }
      });
      document.addEventListener('pointerdown', event => { if (!event.target.closest('#equipment-context-menu')) hideEquipmentOverlays(); });
      document.addEventListener('keydown', event => {
        const menu = document.getElementById('equipment-context-menu'); if (menu.hidden) return;
        if (event.key === 'Escape') {
          event.preventDefault(); const type = menu.dataset.type; hideEquipmentOverlays();
          document.querySelectorAll('[data-equipment-type]').forEach(slot => { if (slot.dataset.equipmentType === type) slot.focus({ preventScroll: true }); });
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); const buttons = Array.from(menu.querySelectorAll('button')); buttons[(buttons.indexOf(document.activeElement) + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
        } else if (event.key === 'Tab') hideEquipmentOverlays();
      });
      window.addEventListener('resize', hideEquipmentOverlays);
      document.getElementById('character-panel-equipment').addEventListener('scroll', hideEquipmentOverlays);
      function selectCharacterTab(selected) {
        hideEquipmentOverlays();
        document.querySelectorAll('.character-detail-action').forEach(tab => {
          const active = tab === selected;
          tab.setAttribute('aria-selected', String(active));
          tab.tabIndex = active ? 0 : -1;
          document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
        });
        if (selected.id === 'character-tab-skills') alignSkillUpgradeScroll(document.querySelector('.character-skill:not([hidden])'));
      }
      window.addEventListener('resize', () => alignSkillUpgradeScroll(document.querySelector('.character-skill:not([hidden])')));
      document.querySelectorAll('.character-detail-action').forEach(tab => {
        tab.addEventListener('click', () => selectCharacterTab(tab));
        tab.addEventListener('keydown', event => {
          const tabs = Array.from(document.querySelectorAll('.character-detail-action'));
          let index = tabs.indexOf(tab);
          if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
          else if (event.key === 'ArrowLeft') index = (index - 1 + tabs.length) % tabs.length;
          else if (event.key === 'Home') index = 0;
          else if (event.key === 'End') index = tabs.length - 1;
          else return;
          event.preventDefault();
          selectCharacterTab(tabs[index]);
          tabs[index].focus({ preventScroll: true });
        });
      });
      // 모든 화면 상태와 이벤트를 준비한 뒤 최초 주소에 해당하는 화면을 엽니다.
      showSection(sectionFromHash());
    

// Live completion of the ORIGINAL UI. No gacha-ai renderer or legacy engine is loaded.
function model(card){return live.catalog.find(c=>c.id===card?.dataset.characterId);}
function owned(card){return live.characters[card?.dataset.characterId];}
function getCharacterBaseStats(card){return E.statsFor(model(card),owned(card));}
function getCharacterSkillNames(card){return model(card).skillNames;}
function getCharacterProfile(card){return model(card).profile;}
function getCharacterSkillLevels(card){return owned(card).skillLevels;}
function getCharacterOutfits(card){return owned(card).outfits;}
function getCharacterEquipment(card){const o=owned(card);o.equipmentUi??={selectedType:'weapon',equipped:o.equipped,items:live.equipment};o.equipmentUi.equipped=o.equipped;o.equipmentUi.items=live.equipment;return o.equipmentUi;}
function getPreviewEquipmentInventory(){return live.equipment;}
function nativeMessage(title,description,actions=[]){
 let dialog=document.getElementById('live-message');if(!dialog){dialog=document.createElement('dialog');dialog.id='live-message';dialog.className='summon-dialog';dialog.setAttribute('aria-label','게임 알림');document.querySelector('.game-frame').append(dialog);}
 dialog.replaceChildren();const header=document.createElement('div');header.className='summon-dialog-heading';const heading=document.createElement('h2');heading.textContent=title;const close=document.createElement('button');close.className='summon-dialog-close';close.textContent='×';close.setAttribute('aria-label','닫기');close.onclick=()=>dialog.close();header.append(heading,close);const body=document.createElement('div');body.className='summon-dialog-body';const p=document.createElement('p');p.textContent=description;p.style.whiteSpace='pre-wrap';body.append(p);for(const [label,fn] of actions){const b=document.createElement('button');b.className='world-secondary';b.textContent=label;b.onclick=()=>{dialog.close();nativeRun(fn);};body.append(b);}dialog.append(header,body);if(!dialog.open)dialog.showModal();
}
function syncLive(){if(!nativeReady)return;
 live.gold=previewGameWallet.gold;live.materials={...previewInventoryMaterialCounts};live.skillMaterials={...previewSkillMaterials};live.energy=gameEnergy;live.formations=previewFormations.map(f=>({name:f.name,members:f.members.map(c=>c?.dataset.characterId||null)}));live.selectedFormation=selectedFormation;live.dungeonProgress=Object.fromEntries(dungeonFloorProgress);
 for(const card of document.querySelectorAll('#characters-screen .character-portrait-card')){const o=owned(card);if(!o)continue;o.level=Number(card.dataset.level)||o.level;o.awakening=Number(card.dataset.awakeningStage??o.awakening);o.equipped=getCharacterEquipment(card).equipped;delete o.equipmentUi;}
 const snapshot=structuredClone(live);saveQueue=saveQueue.catch(()=>{}).then(()=>Runtime.save(snapshot)).catch(error=>{nativeMessage('저장 실패','진행을 내보낸 후 저장 공간을 확인하세요. '+error.message);throw error;});saveQueue.catch(()=>{});
}
function syncWallet(){document.getElementById('story-current-chapter').textContent=live.chapters.find(c=>c.state==='new')?.name||live.chapters.at(-1)?.name||'세계 생성 필요';previewGameWallet.gold=live.gold;Object.assign(previewInventoryMaterialCounts,live.materials);Object.assign(previewSkillMaterials,live.skillMaterials);gameEnergy=live.energy;document.getElementById('game-diamonds').textContent=live.gems.toLocaleString('ko-KR');document.getElementById('game-gold').textContent=live.gold.toLocaleString('ko-KR');document.getElementById('game-player-name').textContent=live.settings.playerName||live.name;document.getElementById('game-player-rank').textContent=String(1+Math.floor(live.rankXp/120));document.getElementById('game-player-exp').textContent=live.rankXp%120+' / 120';const bar=document.getElementById('game-player-exp-bar');bar.value=live.rankXp%120;bar.max=120;bar.setAttribute('aria-valuetext',bar.value+' / 120');document.querySelector('.game-player-status').setAttribute('aria-label','플레이어 정보');document.querySelector('.game-currencies').setAttribute('aria-label','보유 재화');document.getElementById('game-diamonds').parentElement.setAttribute('aria-label','다이아 '+live.gems);document.getElementById('game-gold').parentElement.setAttribute('aria-label','골드 '+live.gold);for(const card of document.querySelectorAll('#characters-screen .character-portrait-card'))if(owned(card))card.dataset.affinity=owned(card).affinity;updateGameEnergy();}
async function nativeRun(fn){if(uiBusy)return;uiBusy=true;const frame=document.querySelector('.game-frame');frame.inert=true;frame.setAttribute('aria-busy','true');try{await fn();syncLive();await saveQueue;}catch(error){nativeMessage('진행할 수 없습니다',error.message);}finally{frame.inert=false;frame.removeAttribute('aria-busy');uiBusy=false;}}
function liveRoster(){const grid=document.querySelector('#characters-screen .character-card-grid');grid.innerHTML=live.owned.map(id=>Runtime.cardMarkup(live,live.catalog.find(c=>c.id===id))).join('');for(const card of grid.querySelectorAll('.character-portrait-card')){card.dataset.awakeningStage=owned(card).awakening;card.dataset.affinity=owned(card).affinity;card.addEventListener('click',()=>openCharacterDetail(card));card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openCharacterDetail(card);}});}const cards=new Map(Array.from(grid.children,c=>[c.dataset.characterId,c]));previewFormations.splice(0,previewFormations.length,...live.formations.map(f=>({name:f.name,members:f.members.map(id=>cards.get(id)||null)})));selectedFormation=Math.max(0,Math.min(live.selectedFormation||0,previewFormations.length-1));previewParty=previewFormations[selectedFormation]?.members||Array(6).fill(null);}
function showGameView(view){original_showGameView(view);if(nativeReady){syncWallet();if(view==='summon'){document.getElementById('summon-status').textContent='5성 2% · 4성 13% · 90회 5성 보장 ('+live.pity+'/90) · 10회 4성 이상 ('+live.pull4+'/10)';document.getElementById('summon-once').textContent='1회 소환 · 160';document.getElementById('summon-ten').textContent='10회 소환 · 1,600';}syncLive();}}
function resetCombatPreview(){stopCombatPreview();combatPreviewState=live.battle&&!live.battle.result?live.battle:null;if(combatPreviewState)renderCombatPreview();}
function alliesForBattle(){return previewParty.map((card,i)=>{if(!card)return {id:'ally-'+i,team:'ally',slot:i,empty:true,hp:0,maxHp:1,name:'미편성',energy:0,cooldown:0,speed:0};const info=getCharacterEquipmentTotalStats(card),c=model(card),o=owned(card);return {...info,id:'ally-'+i,characterId:c.id,role:c.role,specials:getCharacterEquipmentSpecialEffects(card),activeCooldown:getCharacterActiveCooldown(card).current,skillLevels:o.skillLevels,team:'ally',slot:i,name:c.name,maxHp:info.hp,hp:info.hp,energy:100,cooldown:0,shield:0,image:card.querySelector('img')?.getAttribute('src')||''};});}
function playCombatPreviewAction(skillId,target){const b=combatPreviewState;if(!b||b.busy||b.result||battleBriefingOpen)return;try{E.action(b,skillId,target?.id);b.busy=true;b.selectedSkill=null;if(skillId==='ultimate'){const overlay=document.getElementById('combat-ultimate');overlay.textContent=b.queue[0].name+' · '+(live.catalog.find(c=>c.id===b.queue[0].characterId)?.skillNames.ultimate||'궁극기');overlay.hidden=false;clearTimeout(combatOverlayTimer);combatOverlayTimer=setTimeout(()=>overlay.hidden=true,900);}syncLive();clearTimeout(combatPreviewTimer);combatPreviewTimer=setTimeout(advanceCombatPreviewTurn,600/Number(document.getElementById('combat-preview-screen').dataset.speed||1));}catch(error){nativeMessage('스킬 사용 불가',error.message);}}
function advanceCombatPreviewTurn(){const b=combatPreviewState;if(!b)return;if(b.result){finishLiveBattle();return;}E.advance(b);renderCombatPreview();syncLive();scheduleCombatPreview();}
function scheduleCombatPreview(){const b=combatPreviewState;if(b?.busy)return;clearTimeout(combatPreviewTimer);if(!b||b.result||battleBriefingOpen||document.hidden||document.getElementById('game-preview').dataset.view!=='combat-preview')return;const current=b.queue[0];if(!current)return;if(current.team==='ally'&&document.getElementById('combat-auto').getAttribute('aria-pressed')!=='true')return;combatPreviewTimer=setTimeout(()=>{const skill=current.energy>=100?'ultimate':current.cooldown===0?'active':'basic';playCombatPreviewAction(skill,b.units.find(u=>u.team!==current.team&&u.hp>0&&!u.empty));},700/Number(document.getElementById('combat-preview-screen').dataset.speed||1));}
function finishLiveBattle(){const b=combatPreviewState;if(!b)return;stopCombatPreview();const rewards=E.settle(live,b);if(rewards&&b.result==='win'){if(b.context.source==='dungeon'){recordDungeonFloorClear(b.context.category,b.context.element,b.context.floor,3);if(b.context.category==='equipment')dropLiveEquipment();}}syncWallet();syncLive();renderPreviewChapters();nativeMessage(b.result==='win'?'승리':'패배',b.result==='win'?'골드 '+b.rewards.gold.toLocaleString('ko-KR')+' · 다이아 '+b.rewards.gems+'\n보상과 진행이 저장되었습니다.':'캐릭터를 성장시키고 다시 도전하세요.',[['돌아가기',()=>{live.battle=null;combatPreviewState=null;showGameView(b.context.source==='story'?'chapters':'materials');}]]);}
function dropLiveEquipment(){const asset=equipmentAssetCatalog[Math.floor(Math.random()*equipmentAssetCatalog.length)];const base={weapon:{attack:40},armor:{hp:300},gloves:{attack:20},shoes:{speed:5},ring:{defense:20},necklace:{hp:150}}[asset.slot];const [key,value]=Object.entries(base)[0];const png=['pathfinder-weapon.png','pathfinder-armor.png','pathfinder-ring.png'];const image=asset.file;live.equipment.push(refreshEquipmentOptionStats({id:E.uuid(),name:asset.name,type:asset.slot,classId:asset.classId,setId:asset.setId,image:'assets/equipment/'+image,rarity:3,enhancement:0,mainOption:{key,value},subOptions:[{key:'hp',value:40}]}));}
async function enterLiveStory(card){const chapter=previewChapters.find(c=>c.id===selectedPreviewChapter);const episode=Number(card.querySelector('.scenario-number').textContent)-1;if(card.dataset.state==='locked')throw Error('이전 시나리오를 완료하세요.');activeStory=await Runtime.storyFor(live,chapter.id,episode);activeEpisode=episode;activeStoryKey=chapter.id+':'+episode;previewScenarioCard=card;dialoguePreviewLines=activeStory.scenes.map(line=>line.text);document.getElementById('story-preview-title').textContent=activeStory.title;document.getElementById('story-preview-chapter').textContent=chapter.name+' · '+(episode+1)+'화';if(live.settings.locations&&live.settings.imageModel){try{const url=await Runtime.imageFor(live,'background:'+activeStoryKey,{prompt:activeStory.backgroundPrompt});document.getElementById('story-preview-screen').style.backgroundImage='url("'+url+'")';}catch(error){nativeMessage('배경 생성 실패',error.message);}}await prepareStoryArt();showGameView('story-preview');startDialoguePreview();}
function nativeChoice(){const chapter=previewChapters.find(c=>c.id===selectedPreviewChapter);const proceed=choice=>{if(choice&&!live.choices.some(c=>c.key===activeStoryKey))live.choices.push({key:activeStoryKey,choice});openBattleStageSetup({source:'story',chapterId:chapter.id,episode:activeEpisode,title:activeStory.title,subtitle:chapter.name+' · '+(activeEpisode+1)+'화',objective:'모든 적을 처치하세요.',description:chapter.episodes[activeEpisode].goal,enemies:(activeStory.enemies||[]).map((enemy,i)=>({...enemy,image:live.images['enemy:'+activeStoryKey+':'+i]})),image:live.images['battle:'+activeStoryKey]||live.images['background:'+activeStoryKey]||'assets/dungeons/story-entry.png'});syncLive();};if(activeStory.characterId){showGameView('characters');return;}const recorded=live.choices.find(c=>c.key===activeStoryKey);if(recorded||!activeStory.choices.length)proceed(recorded?.choice);else nativeMessage('다음 행동',activeStory.summary,activeStory.choices.map(choice=>[choice,()=>proceed(choice)]));}
function exportLive(){syncLive();const blob=new Blob([JSON.stringify(live)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gacha-game-'+live.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function renderLiveWorlds(){const list=document.getElementById('world-list-view');list.querySelectorAll('[data-live-world]').forEach(n=>n.remove());for(const world of await Runtime.list()){const row=document.createElement('div');row.className='saved-connection';row.dataset.liveWorld=world.id;const name=document.createElement('strong');name.textContent=world.bible?.title||world.name;const p=document.createElement('p');p.textContent=world.owned.length?'보유 '+world.owned.length+'명 · '+world.chapters.reduce((n,c)=>n+c.completed,0)+'/120 완료':'생성 '+(world.jobs.status||'대기')+' · '+(world.jobs.error||'저장된 단계부터 재개 가능');const open=document.createElement('button');open.className='world-secondary';open.textContent=world.owned.length?'게임 시작':'생성 이어하기';open.onclick=()=>nativeRun(async()=>{syncLive();await saveQueue;await Runtime.activate(world.id);location.hash=world.owned.length?'game-preview':'worlds';location.reload();});const details=document.createElement('div');details.append(name,p);row.append(details,open);list.append(row);}}
function readNativeSettings(){const value=id=>document.getElementById(id).value;const checked=id=>document.getElementById(id).checked;return {name:value('world-name').trim()||'새 세계',description:value('world-description'),playerName:value('world-player-name'),contactName:value('world-contact-name'),textModel:value('world-text-model'),imageModel:value('world-image-model'),lorebooks:readWorldLorebooks(),overall:value('world-story-guidance'),scene:value('world-scene-guidance'),cg:value('world-cg-guidance'),characterStory:value('world-character-guidance'),portraits:checked('world-generate-portraits'),locations:checked('world-generate-locations'),enemies:checked('world-generate-enemies'),battles:checked('world-generate-battles'),cgFrequency:Number(value('world-cg-frequency')),landscapeWidth:Number(value('world-landscape-width')),landscapeHeight:Number(value('world-landscape-height')),portraitWidth:Number(value('world-portrait-width')),portraitHeight:Number(value('world-portrait-height'))};}
async function nativeGenerate(){const settings=readNativeSettings();if(!settings.textModel)throw Error('텍스트 모델 연결을 선택하세요.');if(!settings.description.trim())throw Error('구성 세계를 입력하세요.');syncLive();await saveQueue;const draft=live.owned.length||JSON.stringify(live.settings)!==JSON.stringify(settings)?E.createWorld(settings):live.jobs.status?live:E.createWorld(settings);if(draft.jobs.status&&JSON.stringify(draft.settings)!==JSON.stringify(settings))throw Error('재개 시 기존 설정을 유지하세요. 다른 설정은 새 세계로 생성하세요.');draft.settings=settings;live=draft;nativeReady=false;await Runtime.save(live);localStorage.setItem('gacha-game-active',live.id);try{await Runtime.generateWorld(live,{status:stage=>document.getElementById('world-status').textContent=stage+' 생성 중… 각 단계가 저장됩니다.'});if(settings.imageModel){const imageTasks=[];if(settings.locations)imageTasks.push(['lobby',{prompt:live.bible.backgroundPrompt}]);if(settings.portraits)for(const id of live.owned){const c=live.catalog.find(c=>c.id===id);imageTasks.push(['portrait:'+id,{prompt:'detailed character illustration, simple background',kind:'portrait',characters:[{prompt:c.identityPrompt+', '+c.outfitPrompt,center:{x:.5,y:.5}}]}]);}for(const [key,spec] of imageTasks){document.getElementById('world-status').textContent=key+' 이미지 생성 중…';try{const image=await Runtime.imageFor(live,key,spec);if(key.startsWith('portrait:'))live.characters[key.slice(9)].outfits.items[0].imageUrl=image;}catch(error){document.getElementById('world-status').textContent='이미지 실패: '+error.message+' · 세계와 진행은 보존됩니다.';}}}await Runtime.save(live);location.hash='game-preview';location.reload();}catch(error){document.getElementById('world-status').textContent=error.message+' · 생성 이어하기로 재개하세요.';await renderLiveWorlds();throw error;}}

// Replace the original unfinished handlers at their actual controls.
document.addEventListener('click',event=>{
 const control=event.target.closest('button,a');if(!control)return;const id=control.id;
 const intercept=fn=>{event.preventDefault();event.stopImmediatePropagation();nativeRun(fn);};
 if(id==='world-next'&&worldStepIndex===6)return intercept(nativeGenerate);
 if(id==='summon-once'||id==='summon-ten')return intercept(()=>{syncLive();const results=E.summon(live,id==='summon-ten'?10:1);syncWallet();liveRoster();syncLive();nativeMessage('소환 결과',results.map(r=>r.name+' · '+r.rarity+'성'+(r.duplicate?' · 중복 각성 +1':' · 신규')).join('\n'));renderSummon();document.getElementById('summon-status').textContent='5성 보장 '+live.pity+'/90 · 4성 이상 '+live.pull4+'/10';});
 if(id==='summon-history')return intercept(()=>nativeMessage('소환 기록',live.history.map(h=>h.name+' · '+h.rarity+'성 · '+new Date(h.at).toLocaleString('ko-KR')).join('\n')||'소환 기록이 없습니다.'));
 if(id==='summon-appearances')return intercept(()=>nativeMessage('출현 목록 · 확률',live.catalog.map(c=>c.name+' · '+c.rarity+'성').join('\n')+'\n5성 2% · 4성 13% · 3성 85%\n90회 5성 보장 · 10회 4성 이상 · 소환당 160 다이아'));
 if(id==='summon-regenerate')return intercept(async()=>{if(!live.settings.imageModel)throw Error('세계 설정에서 이미지 모델을 선택하세요.');const c=live.catalog.find(c=>c.rarity===5);if(!c)throw Error('세계를 먼저 생성하세요.');const image=await Runtime.imageFor(live,'banner:standard',{prompt:'cinematic fantasy recruitment banner, no text',kind:'banner',characters:[{prompt:c.identityPrompt+', '+c.outfitPrompt,center:{x:.5,y:.5}}]},{regenerate:true,retry:true});previewSummonBanners[0].imageUrl=image;renderSummon();});
 if(id==='character-growth-button')return intercept(()=>{syncLive();const result=E.grow(live,selectedCharacterCard.dataset.characterId),o=owned(selectedCharacterCard);selectedCharacterCard.dataset.level=o.level;selectedCharacterCard.dataset.maxLevel=20+o.ascend*20;selectedCharacterCard.querySelector('.character-card-level').textContent='Lv. '+o.level;syncWallet();renderCharacterInfo(selectedCharacterCard);document.getElementById('character-detail-level').textContent='Lv. '+o.level;syncLive();nativeMessage(result,'레벨 '+o.level+' · 돌파 '+o.ascend);});
 if(id==='story-dialogue-complete')return intercept(()=>{if(dialogueIsTyping||dialogueLineIndex!==dialoguePreviewLines.length-1)return;nativeChoice();});
 if(control.closest('.scenario-list')&&control.classList.contains('scenario-card'))return intercept(()=>enterLiveStory(control));
 if(id==='battle-briefing-start')return intercept(()=>{if(!battleBriefingOpen)return;syncLive();combatPreviewState=E.startCombat(live,battleStageContext,alliesForBattle());closeBattleBriefing();syncWallet();renderCombatPreview();syncLive();scheduleCombatPreview();});
 if(id==='combat-preview-back'&&live.battle&&!live.battle.result)return intercept(()=>nativeMessage('전투','진행 중인 전투로 돌아가거나 퇴각할 수 있습니다.',[['계속 전투',()=>scheduleCombatPreview()],['퇴각',()=>{live.battle.result='lose';combatPreviewState=live.battle;finishLiveBattle();}]]));
},true);
// Native drag and drop remains; add click/keyboard placement for touch and keyboard users.
document.getElementById('party-screen').addEventListener('click',event=>{const slot=event.target.closest('[data-slot]');if(slot){nativeSlot=Number(slot.dataset.slot);slot.tabIndex=0;slot.focus();return;}const member=event.target.closest('.party-member');if(!member)return;const cards=Array.from(document.querySelectorAll('#characters-screen .character-portrait-card')),card=cards[Number(member.dataset.member)];const index=nativeSlot??previewParty.findIndex(x=>!x);if(index<0)return;previewParty.splice(0,6,...movePartyMember(previewParty,index,card));nativeSlot=null;renderParty();syncLive();});
document.getElementById('party-screen').addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-slot],.party-member')){event.preventDefault();event.target.click();}});
const restorePartyRender=renderParty;renderParty=function(){restorePartyRender();document.querySelectorAll('.party-slot-select,.party-member').forEach(node=>{node.tabIndex=0;node.setAttribute('role','button');});};
document.addEventListener('click',()=>setTimeout(()=>{if(nativeReady&&!uiBusy){live.gold=previewGameWallet.gold;document.getElementById('game-gold').textContent=live.gold.toLocaleString('ko-KR');syncLive();}},0));
document.addEventListener('drop',()=>setTimeout(syncLive,0));document.addEventListener('submit',()=>setTimeout(syncLive,0));document.addEventListener('change',()=>setTimeout(syncLive,0));window.addEventListener('pagehide',syncLive);
for(const [key,value] of Object.entries(live.dungeonProgress))dungeonFloorProgress.set(key,value);Object.assign(previewSkillMaterials,live.skillMaterials);liveRoster();previewSummonBanners[0].imageUrl=live.images['banner:standard']||null;nativeReady=true;syncWallet();
if(live.images.lobby)document.getElementById('game-stage').style.background='url("'+live.images.lobby+'") center/cover';
const toolbar = document.querySelector('.world-toolbar');
const addWorldButton = document.getElementById('add-world');
const exportButton = document.createElement('button');
exportButton.type = 'button';
exportButton.className = 'world-secondary';
exportButton.textContent = '현재 세계 내보내기';
exportButton.onclick = exportLive;
toolbar.insertBefore(exportButton, addWorldButton);
const importButton = document.createElement('button');
importButton.type = 'button';
importButton.className = 'world-secondary';
importButton.textContent = '저장 가져오기';
const importFile = document.createElement('input');
importFile.type = 'file';
importFile.accept = '.json';
importFile.hidden = true;
importFile.setAttribute('aria-label', '게임 저장 가져오기');
importButton.onclick = () => importFile.click();
importFile.onchange = () => nativeRun(async () => {
  const file = importFile.files[0];
  if (!file) return;
  importFile.value = '';
  if (file.size > 200 * 1024 * 1024) throw Error('200MB 이하의 파일을 선택하세요.');
  const incoming = E.validateWorldSave(JSON.parse(await file.text()));
  await Runtime.save(incoming);
  await Runtime.activate(incoming.id);
  nativeReady = false;
  location.hash = 'game-preview';
  location.reload();
});
toolbar.insertBefore(importButton, addWorldButton);
toolbar.append(importFile);
await renderLiveWorlds();document.getElementById('worlds-nav').addEventListener('click',()=>renderLiveWorlds().catch(e=>nativeMessage('세계 목록',e.message)));
const homeNote=document.createElement('div');homeNote.className='world-note';homeNote.id='live-home-note';homeNote.style.cssText='position:absolute;left:40px;top:40px;max-width:500px;pointer-events:none';homeNote.textContent=live.bible?live.bible.title:'세계관에서 나만의 세계를 생성하세요.';document.getElementById('game-stage').style.position='relative';document.getElementById('game-stage').append(homeNote);
const nativeStyle=document.createElement('style');nativeStyle.textContent='#game-preview:not([data-view="home"]) #live-home-note{display:none}.combat-unit[data-dead="true"]{opacity:.28}.world-toolbar{gap:12px;flex-wrap:wrap;align-items:center}.world-toolbar #add-world{margin-left:auto}#live-message .summon-dialog-body{padding:24px;line-height:1.8}#live-message .world-secondary{margin:8px}#world-list-view>.saved-connection{margin-top:16px}#story-preview-screen{background-position:center;background-size:cover}';document.head.append(nativeStyle);
if(live.battle){combatPreviewState=live.battle;battleStageContext=live.battle.context;showSection('game-preview');battleStageContext=live.battle.context;document.getElementById('combat-preview-title').textContent=battleStageContext.title||'전투 이어하기';document.getElementById('combat-preview-chapter').textContent=battleStageContext.subtitle||'';document.getElementById('combat-preview-screen').style.setProperty('--combat-background-image','url("'+battleStageContext.image+'")');original_showGameView('combat-preview');renderCombatPreview();if(live.battle.result)finishLiveBattle();else scheduleCombatPreview();}
if(!live.owned.length&&live.jobs.status){document.getElementById('add-world').click();for(const [id,key] of [['world-name','name'],['world-description','description'],['world-player-name','playerName'],['world-contact-name','contactName'],['world-story-guidance','overall'],['world-scene-guidance','scene'],['world-cg-guidance','cg'],['world-character-guidance','characterStory']])document.getElementById(id).value=live.settings[key]||'';await loadSavedConnections();refreshWorldModels();document.getElementById('world-text-model').value=live.settings.textModel||'';document.getElementById('world-image-model').value=live.settings.imageModel||'';for(const [id,key] of [['world-generate-portraits','portraits'],['world-generate-locations','locations'],['world-generate-enemies','enemies'],['world-generate-battles','battles']])document.getElementById(id).checked=!!live.settings[key];for(const [id,key] of [['world-cg-frequency','cgFrequency'],['world-landscape-width','landscapeWidth'],['world-landscape-height','landscapeHeight'],['world-portrait-width','portraitWidth'],['world-portrait-height','portraitHeight']])if(live.settings[key]!==undefined)document.getElementById(id).value=live.settings[key];document.getElementById('world-protagonist').value=live.settings.lorebooks?.protagonist?.id||'';document.getElementById('world-background').value=live.settings.lorebooks?.background?.id||'';const ids=new Set((live.settings.lorebooks?.characters||[]).map(c=>c.id));for(const check of document.querySelectorAll('#world-character-lorebooks input'))check.checked=ids.has(check.value);}

function skillDescription(card,key){const heal=model(card).role==='healer';return key==='passive'?'항상 최대 체력·공격력·방어력 '+(getCharacterSkillLevels(card).passive*2)+'% 증가':key==='basic'?heal?'체력 비율이 가장 낮은 아군을 공격력 200%로 회복':'선택한 적에게 공격력 100% 피해':key==='active'?heal?'체력 비율이 가장 낮은 아군을 공격력 360%로 회복':'선택한 적에게 공격력 180% 피해':'에너지 100 소비 · '+(heal?'전체 아군을 공격력 320%로 회복':'전체 적에게 공격력 160% 피해');}
function renderCharacterSkills(card){original_renderCharacterSkills(card);for(const key of ['basic','active','ultimate','passive']){const article=document.getElementById('skill-detail-'+key);article.querySelector('.character-skill-description').textContent=skillDescription(card,key);article.querySelector('.character-skill-cooldown').textContent=key==='active'?'쿨타임 '+getCharacterActiveCooldown(card).current+'턴':key==='ultimate'?'에너지 100% 필요':key==='passive'?'상시 효과':'쿨타임 없음';}}
function renderCharacterInfo(card){original_renderCharacterInfo(card);const o=owned(card),cap=20+o.ascend*20;document.querySelector('.character-info-exp-label span').textContent='성장 단계';document.getElementById('character-info-exp-count').textContent=o.level+' / '+cap;const bar=document.getElementById('character-info-exp-bar');bar.value=o.level;bar.max=cap;bar.setAttribute('aria-valuetext',o.level+' / '+cap);document.getElementById('character-growth-button').title=o.level>=cap?'공통 촉매 '+(5*(o.ascend+1))+'개 · 골드 '+(10000*(o.ascend+1)):'성장 결정 1개 · 골드 '+(o.level*1000);}
function renderCombatPreview(){const actor=combatPreviewState?.queue[0],c=live.catalog.find(c=>c.id===actor?.characterId);if(c){const card=Array.from(document.querySelectorAll('#characters-screen .character-portrait-card')).find(c=>c.dataset.characterId===actor.characterId);for(const skill of combatPreviewSkills){skill.title=c.skillNames[skill.id];skill.description=skillDescription(card,skill.id);skill.condition=skill.id==='active'?'쿨타임 '+(actor.activeCooldown||3)+'턴':skill.id==='ultimate'?'에너지 100% 필요':skill.id==='passive'?'상시 효과':'쿨타임 없음';}}original_renderCombatPreview();const hint=document.getElementById('combat-action-hint');hint.hidden=false;hint.textContent=actor?.team==='enemy'?'적군 행동 중':combatPreviewState?.selectedSkill?'대상 카드를 선택하세요.':'사용할 스킬을 선택하세요.';}
function filterNativeCharacters(){const query=document.getElementById('character-search').value.trim().toLocaleLowerCase(),role=document.getElementById('character-role').value,element=document.getElementById('character-element').value,sort=document.getElementById('character-sort').value;const grid=document.querySelector('#characters-screen .character-card-grid'),cards=Array.from(grid.children);cards.sort((a,b)=>sort==='level'?owned(b).level-owned(a).level:sort==='power'?getCharacterEquipmentTotalStats(b).power-getCharacterEquipmentTotalStats(a).power:sort==='new'?live.owned.indexOf(b.dataset.characterId)-live.owned.indexOf(a.dataset.characterId):Number(b.dataset.rarity)-Number(a.dataset.rarity));for(const card of cards){const c=model(card);card.hidden=(!c.name.toLocaleLowerCase().includes(query)||role!=='all'&&role!==c.role||element!=='all'&&element!==c.element);grid.append(card);}}
for(const id of ['character-search','character-role','character-element','character-sort'])document.getElementById(id).addEventListener(id==='character-search'?'input':'change',filterNativeCharacters);

async function prepareStoryArt(){if(!live.settings.imageModel)return;const safe=async(key,spec)=>{try{return await Runtime.imageFor(live,key,spec);}catch(error){document.getElementById('story-preview-chapter').textContent+=' · 이미지 일부 미생성';return null;}};if(live.settings.battles)await safe('battle:'+activeStoryKey,{prompt:activeStory.backgroundPrompt});if(live.settings.enemies)for(const [i,enemy] of (activeStory.enemies||[]).entries())await safe('enemy:'+activeStoryKey+':'+i,{prompt:enemy.imagePrompt,kind:'enemy'});const n=live.settings.cgFrequency;if(n>0&&(activeEpisode+1)%n===0&&activeStory.cg){const plan=activeStory.cg;const image=await safe('cg:'+activeStoryKey,{prompt:plan.basePrompt,kind:'cg',characters:plan.cast.map(v=>{const c=live.catalog.find(c=>c.id===v.characterId);return {prompt:c.identityPrompt+', '+c.outfitPrompt+', '+v.actionPrompt,center:v.center};})});if(image){let art=document.getElementById('live-story-cg');if(!art){art=document.createElement('img');art.id='live-story-cg';art.alt='장면 CG';art.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none';document.getElementById('story-preview-screen').prepend(art);}art.src=image;}}else document.getElementById('live-story-cg')?.remove();}
async function generateLiveOutfit(){if(!selectedCharacterCard)throw Error('캐릭터를 선택하세요.');const c=model(selectedCharacterCard),o=owned(selectedCharacterCard);if(!live.settings.imageModel)throw Error('세계 설정에서 이미지 모델을 선택하세요.');live.jobs.outfits??={};let draft=live.jobs.outfits[c.id];if(!draft){const r=await Runtime.request('text',{connectionId:live.settings.textModel,system:'Return JSON only. Preserve the confirmed character appearance. Design clothing only, never body, face, hair or eyes.',prompt:JSON.stringify({world:live.bible,character:c,instructions:live.settings.cg,schema:{name:'Korean outfit name',clothingPrompt:'English garments, accessories, colors only'}})});if(typeof r.data?.name!=='string'||!r.data.name.trim()||typeof r.data.clothingPrompt!=='string'||!r.data.clothingPrompt.trim()||r.data.clothingPrompt.length>2000)throw Error('의상 응답 형식 오류');draft={id:E.uuid(),name:r.data.name.slice(0,80),clothingPrompt:r.data.clothingPrompt};live.jobs.outfits[c.id]=draft;await Runtime.save(live);}const image=await Runtime.imageFor(live,'outfit:'+draft.id,{prompt:'character outfit illustration, simple background',kind:'portrait',characters:[{prompt:c.identityPrompt+', '+draft.clothingPrompt,center:{x:.5,y:.5}}]},{retry:true});if(!o.outfits.items.some(v=>v.id===draft.id))o.outfits.items.push({id:draft.id,name:draft.name,imageUrl:image,clothingPrompt:draft.clothingPrompt});delete live.jobs.outfits[c.id];renderCharacterOutfits(selectedCharacterCard);syncLive();}
const outfitGenerate=document.createElement('button');outfitGenerate.className='character-growth-button';outfitGenerate.textContent='의상 생성';outfitGenerate.onclick=()=>nativeRun(generateLiveOutfit);document.querySelector('.character-outfits-heading').append(outfitGenerate);
const portraitGenerate=document.createElement('button');portraitGenerate.className='character-growth-button';portraitGenerate.textContent='기본 일러스트 생성';portraitGenerate.onclick=()=>nativeRun(async()=>{const c=model(selectedCharacterCard),o=owned(selectedCharacterCard);const image=await Runtime.imageFor(live,'portrait:'+c.id,{prompt:'character illustration, simple background',kind:'portrait',characters:[{prompt:c.identityPrompt+', '+c.outfitPrompt,center:{x:.5,y:.5}}]},{regenerate:true,retry:true});o.outfits.items.find(v=>v.id==='default').imageUrl=image;syncCharacterOutfitImage(selectedCharacterCard);syncLive();});document.querySelector('.character-profile').append(portraitGenerate);
const imageHistory=document.createElement('button');imageHistory.className='world-secondary';imageHistory.type='button';imageHistory.textContent='이미지 생성 기록';imageHistory.onclick=()=>{const jobs=Object.entries(live.jobs.images||{});nativeMessage('이미지 생성 기록',jobs.map(([key,j])=>key+' · '+j.status+(j.error?' · '+j.error:'')).join('\n')||'기록 없음',jobs.filter(([,j])=>j.status==='failed').map(([key,j])=>[key+' 재시도',async()=>{await Runtime.imageFor(live,key,j,{retry:true});if(key.startsWith('portrait:')){const o=live.characters[key.slice(9)];if(o)o.outfits.items.find(v=>v.id==='default').imageUrl=live.images[key];}syncLive();}]));};toolbar.insertBefore(imageHistory,addWorldButton);

function getCharacterAffinity(card){return Math.floor(owned(card).affinity);}

const originalAffinityRender=renderCharacterAffinity;renderCharacterAffinity=function(card){originalAffinityRender(card);document.querySelectorAll('.character-affinity-story').forEach(story=>{story.tabIndex=story.dataset.unlocked==='true'?0:-1;story.setAttribute('role','button');story.setAttribute('aria-disabled',String(story.dataset.unlocked!=='true'));});};
for(const story of document.querySelectorAll('.character-affinity-story')){story.addEventListener('click',()=>nativeRun(async()=>{if(story.dataset.unlocked!=='true')throw Error('호감도가 부족합니다.');const c=model(selectedCharacterCard),index=Number(story.dataset.requiredAffinity);activeStory=await Runtime.storyFor(live,'',index,{characterId:c.id});activeStory.characterId=c.id;activeEpisode=index;activeStoryKey='character:'+c.id+':'+index;dialoguePreviewLines=activeStory.scenes.map(line=>line.text);document.getElementById('story-preview-title').textContent=activeStory.title;document.getElementById('story-preview-chapter').textContent=c.name+' · 호감도 '+index;document.getElementById('story-preview-screen').style.backgroundImage='';await prepareStoryArt();showGameView('story-preview');startDialoguePreview();}));story.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();story.click();}});}
document.getElementById('story-preview-back').addEventListener('click',event=>{if(activeStory?.characterId){event.stopImmediatePropagation();showGameView('character-detail');}},true);

function getCharacterEquipmentTotalStats(card,equipmentState){const stats=original_getCharacterEquipmentTotalStats(card,equipmentState);stats.power=Math.round(stats.hp/4+stats.attack*3+stats.defense*2+stats.speed);return stats;}
