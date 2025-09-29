import { setModelOpacity, applyDecal } from './model.js';
import { defectLog, startAlignmentProcess } from './interactions.js';
import { getScene, getModel, getBimData, getDebugPlanesGroup } from './main.js';

// This is the fully integrated UI management script
export function setupUIListeners(renderer, loadFileCallback, startARCallback) {

    // --- DOM Elements ---
    const lobbyScreen = document.getElementById('lobbyScreen');
    const arScreen = document.getElementById('arScreen');
    const startArButton = document.getElementById('startArButton');
    const zipFileInput = document.getElementById('zipFileInput');
    const projectCarousel = document.querySelector('.project-carousel');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const projectNameInfo = document.getElementById('projectName');
    const statusTextInfo = document.getElementById('statusText');
    const toggleVisibilityBtn = document.getElementById('toggleVisibilityBtn');
    const alignModelBtn = document.getElementById('alignModelBtn');
    const opacitySlider = document.getElementById('opacitySlider');
    const resolutionSlider = document.getElementById('resolutionSlider');
    const resolutionSliderLabel = document.getElementById('resolutionSliderLabel');
    const modelScaleSlider = document.getElementById('modelScaleSlider');
    const modelScaleLabel = document.getElementById('modelScaleLabel');
    const positionXSlider = document.getElementById('positionXSlider');
    const positionYSlider = document.getElementById('positionYSlider');
    const positionZSlider = document.getElementById('positionZSlider');
    const positionXLabel = document.getElementById('positionXLabel');
    const positionYLabel = document.getElementById('positionYLabel');
    const positionZLabel = document.getElementById('positionZLabel');
    const debugToggle = document.getElementById('debugToggle');
    const showLogBtn = document.getElementById('showLogBtn');
    // Modals
    const defectModal = document.getElementById('defectModal');
    const logModal = document.getElementById('logModal');
    const infoBox = document.getElementById('infoBox');
    const photoInput = document.getElementById('photoInput');
    const capturePhotoBtn = document.getElementById('capturePhotoBtn');
    const saveDefectBtn = document.getElementById('saveDefectBtn');
    const cancelDefectBtn = document.getElementById('cancelDefectBtn');
    const closeLogBtn = document.getElementById('closeLogBtn');

    let projects = [];
    let selectedProject = null;

    // --- Initial State ---
    lucide.createIcons();

    // --- Event Listeners ---
    zipFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const project = {
                id: Date.now(),
                name: file.name.replace('.igj', '').replace(/_/g, ' '),
                file: file
            };
            projects.push(project);
            renderCarousel();
            selectProject(project.id);
        }
    });

    startArButton.addEventListener('click', () => {
        if (selectedProject) {
            startArButton.disabled = true;
            startArButton.querySelector('span').textContent = 'Загрузка...';

            loadFileCallback(selectedProject.file).then(() => {
                lobbyScreen.classList.remove('active');
                arScreen.classList.add('active');
                projectNameInfo.textContent = selectedProject.name;
                setStatusText('Поиск поверхности...');
                startARCallback();
            }).finally(() => {
                startArButton.disabled = false;
                startArButton.querySelector('span').textContent = 'Начать AR сессию';
            });
        }
    });

    settingsBtn.addEventListener('click', () => {
        settingsPanel.style.display = 'block';
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsPanel.style.display = 'none';
    });

    alignModelBtn.addEventListener('click', () => {
        startAlignmentProcess();
    });

    toggleVisibilityBtn.addEventListener('click', () => {
        const model = getModel();
        if(model) {
            model.visible = !model.visible;
        }
    });

    opacitySlider.addEventListener('input', () => {
        const model = getModel();
        if(model) setModelOpacity(model, parseFloat(opacitySlider.value));
    });

    modelScaleSlider.addEventListener('input', () => {
        const scale = parseFloat(modelScaleSlider.value);
        const model = getModel();
        if(model) {
            model.scale.set(scale, scale, scale);
        }
        modelScaleLabel.textContent = `Масштаб модели: ${Math.round(scale * 100)}%`;
    });

    positionXSlider.addEventListener('input', () => {
        const model = getModel();
        if (model) {
            const value = parseFloat(positionXSlider.value);
            model.position.x = value;
            positionXLabel.textContent = `Позиция X: ${value.toFixed(2)}`;
        }
    });

    positionYSlider.addEventListener('input', () => {
        const model = getModel();
        if (model) {
            const value = parseFloat(positionYSlider.value);
            model.position.y = value;
            positionYLabel.textContent = `Позиция Y: ${value.toFixed(2)}`;
        }
    });

    positionZSlider.addEventListener('input', () => {
        const model = getModel();
        if (model) {
            const value = parseFloat(positionZSlider.value);
            model.position.z = value;
            positionZLabel.textContent = `Позиция Z: ${value.toFixed(2)}`;
        }
    });

    resolutionSlider.addEventListener('input', () => {
        const scale = parseFloat(resolutionSlider.value);
        resolutionSliderLabel.textContent = `Качество рендеринга: ${Math.round(scale * 100)}%`;
        if (!renderer.xr.isPresenting) {
            renderer.xr.setFramebufferScaleFactor(scale);
        }
    });

    debugToggle.addEventListener('change', () => {
        const debugPlanesGroup = getDebugPlanesGroup();
        if(debugPlanesGroup) debugPlanesGroup.visible = debugToggle.checked;
    });

    function renderCarousel() {
        const cards = projectCarousel.querySelectorAll('.project-card:not(.add-new)');
        cards.forEach(card => card.remove());

        projects.forEach(project => {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.dataset.projectId = project.id;
            card.innerHTML = `<h3>${project.name}</h3>`;

            card.addEventListener('click', () => selectProject(project.id));
            projectCarousel.prepend(card);
        });
    }

    function selectProject(projectId) {
        selectedProject = projects.find(p => p.id === projectId);

        const cards = projectCarousel.querySelectorAll('.project-card');
        cards.forEach(card => {
            card.classList.toggle('selected', card.dataset.projectId == projectId);
        });

        startArButton.disabled = !selectedProject;
    }

    // --- Wire up all the modal logic ---
    capturePhotoBtn.addEventListener('click', () => {
        photoInput.click();
    });

    photoInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('photoPreview').src = e.target.result;
                document.getElementById('photoPreview').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    saveDefectBtn.addEventListener('click', () => {
        const defectId = parseInt(document.getElementById('defectIdInput').value);
        const defect = defectLog.find(d => d.id === defectId);
        if (defect) {
            defect.description = document.getElementById('defectDescription').value;
            defect.type = document.getElementById('defectType').value;
            defect.criticality = document.getElementById('defectCriticality').value;
            const photoData = document.getElementById('photoPreview').src;
            defect.photo = photoData;

            if (photoData && photoData.startsWith('data:image') && defect.intersection) {
                applyDecal(defect.intersection, photoData);
            }
            console.log("Defect saved:", defect);
        }
        defectModal.style.display = 'none';
    });

    cancelDefectBtn.addEventListener('click', () => {
        const defectId = parseInt(document.getElementById('defectIdInput').value);
        const defectIndex = defectLog.findIndex(d => d.id === defectId);

        if (defectIndex > -1 && !defectLog[defectIndex].description && !defectLog[defectIndex].photo) {
            const markerToRemove = getScene().getObjectByProperty('defectId', defectId);
            if (markerToRemove) getScene().remove(markerToRemove);
            defectLog.splice(defectIndex, 1);
        }
        defectModal.style.display = 'none';
    });

    showLogBtn.addEventListener('click', showDefectLog);
    closeLogBtn.addEventListener('click', () => logModal.style.display = 'none');
}

export function updatePositionSliders() {
    const model = getModel();
    if (model) {
        const positionXSlider = document.getElementById('positionXSlider');
        const positionYSlider = document.getElementById('positionYSlider');
        const positionZSlider = document.getElementById('positionZSlider');
        const positionXLabel = document.getElementById('positionXLabel');
        const positionYLabel = document.getElementById('positionYLabel');
        const positionZLabel = document.getElementById('positionZLabel');

        positionXSlider.value = model.position.x;
        positionYSlider.value = model.position.y;
        positionZSlider.value = model.position.z;

        positionXLabel.textContent = `Позиция X: ${model.position.x.toFixed(2)}`;
        positionYLabel.textContent = `Позиция Y: ${model.position.y.toFixed(2)}`;
        positionZLabel.textContent = `Позиция Z: ${model.position.z.toFixed(2)}`;
    }
}

export function setStatusText(text) {
    const statusTextInfo = document.getElementById('statusText');
    if (statusTextInfo) statusTextInfo.textContent = text;
}


export function isUIActive() {
    const settingsPanel = document.getElementById('settingsPanel');
    const defectModal = document.getElementById('defectModal');
    const logModal = document.getElementById('logModal');
    const infoBox = document.getElementById('infoBox');

    return settingsPanel.style.display === 'block' ||
           defectModal.style.display === 'flex' ||
           logModal.style.display === 'flex' ||
           infoBox.style.display === 'block';
}

export function openDefectEditor(defect) {
    const modal = document.getElementById('defectModal');
    document.getElementById('defectIdInput').value = defect.id;
    document.getElementById('defectDescription').value = defect.description || '';
    document.getElementById('defectType').value = defect.type || 'Конструктивный';
    document.getElementById('defectCriticality').value = defect.criticality || 'Низкая';

    const preview = document.getElementById('photoPreview');
    if (defect.photo) {
        preview.src = defect.photo;
        preview.style.display = 'block';
    } else {
        preview.src = '';
        preview.style.display = 'none';
    }

    document.getElementById('photoInput').value = '';

    modal.style.display = 'flex';
}

export function showDefectLog() {
    const list = document.getElementById('defectLogList');
    list.innerHTML = '';

    if (defectLog.length === 0) {
        list.innerHTML = '<li>Журнал пуст</li>';
    } else {
        defectLog.forEach(defect => {
            const li = document.createElement('li');
            li.dataset.defectId = defect.id;
            li.innerHTML = `
                <img src="${defect.photo || 'https://placehold.co/60x60/333/fff?text=Нет фото'}" alt="Фото">
                <div class="log-item-info">
                    <strong>${defect.type || 'Тип не указан'} (${defect.criticality || 'Критичность не указана'})</strong>
                    <span>${(defect.description || 'Нет описания').substring(0, 50)}...</span>
                </div>
            `;
            li.addEventListener('click', () => {
                const clickedDefect = defectLog.find(d => d.id === defect.id);
                if (clickedDefect) openDefectEditor(clickedDefect);
            });
            list.appendChild(li);
        });
    }
    document.getElementById('logModal').style.display = 'flex';
}

export function showInfo(globalId) {
    const infoBox = document.getElementById('infoBox');
    const content = document.getElementById('infoBoxContent');
    const title = document.getElementById('infoBoxTitle');

    const bimData = getBimData();
    let elementData = null;

    if (typeof bimData === 'object' && bimData !== null) {
        elementData = bimData[globalId];
    }

    if (elementData) {
        title.textContent = elementData.Name || 'Информация об элементе';
        let html = '';
        html += `<div class="info-item"><span class="info-item-key">ID</span><span>${globalId}</span></div>`;
        html += `<div class="info-item"><span class="info-item-key">Тип</span><span>${elementData.IfcType || 'N/A'}</span></div>`;

        if(elementData.Properties) {
            for (const [key, value] of Object.entries(elementData.Properties)) {
                let displayValue;
                if (typeof value === 'object' && value !== null) {
                    displayValue = value.value !== undefined ? value.value : JSON.stringify(value);
                } else {
                    displayValue = value;
                }
                html += `<div class="info-item"><span class="info-item-key">${key}</span><span>${displayValue}</span></div>`;
            }
        }
        content.innerHTML = html;
    } else {
        title.textContent = 'Ошибка';
        content.innerHTML = `<div class="info-item"><span>Информация для элемента с ID ${globalId} не найдена.</span></div>`;
    }
    infoBox.style.display = 'block';
}

