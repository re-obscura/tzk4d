import { setModelOpacity, applyDecal } from './model.js';
import { defectLog } from './interactions.js';
import { getScene, getRenderer, getModel, getBimData, requestScreenshot } from './main.js';

export function setupUIListeners(renderer, loadFileCallback) {
    const resolutionSlider = document.getElementById('resolutionSlider');
    const sliderLabel = document.getElementById('sliderLabel');
    const sliderContainer = document.getElementById('sliderContainer');

    function setResolution(scale) {
        renderer.xr.setFramebufferScaleFactor(scale);
    }
    setResolution(parseFloat(resolutionSlider.value));

    resolutionSlider.addEventListener('input', () => {
        const scale = parseFloat(resolutionSlider.value);
        sliderLabel.textContent = `Качество рендеринга: ${Math.round(scale * 100)}%`;
        if (!renderer.xr.isPresenting) setResolution(scale);
    });

    const controlsContainer = document.getElementById('controlsContainer');
    const toggleModelBtn = document.getElementById('toggleModelBtn');
    const opacitySlider = document.getElementById('opacitySlider');

    toggleModelBtn.addEventListener('click', () => {
        const model = getModel();
        if(model) {
            model.visible = !model.visible;
            toggleModelBtn.textContent = model.visible ? 'Скрыть модель' : 'Показать модель';
        }
    });

    opacitySlider.addEventListener('input', () => {
        const model = getModel();
        if(model) setModelOpacity(model, parseFloat(opacitySlider.value));
    });

    const debugToggle = document.getElementById('debugToggle');
    debugToggle.addEventListener('change', () => {
        const debugPlanesGroup = getScene().getObjectByName("debugPlanesGroup");
        if(debugPlanesGroup) debugPlanesGroup.visible = debugToggle.checked;
    });

    renderer.xr.addEventListener('sessionstart', () => {
        sliderContainer.style.display = 'none';
        if(getModel()) controlsContainer.style.display = 'flex';
    });
    renderer.xr.addEventListener('sessionend', () => {
        sliderContainer.style.display = 'block';
        controlsContainer.style.display = 'none';
    });

    document.getElementById('zipFileInput').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            loadFileCallback(file);
        }
    });

    const defectModal = document.getElementById('defectModal');
    const photoInput = document.getElementById('photoInput');
    const saveDefectBtn = document.getElementById('saveDefectBtn');
    const cancelDefectBtn = document.getElementById('cancelDefectBtn');

    photoInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                updateScreenshotPreview(e.target.result);
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

            if (photoData && defect.intersection) {
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

    const logModal = document.getElementById('logModal');
    document.getElementById('showLogBtn').addEventListener('click', showDefectLog);
    document.getElementById('closeLogBtn').addEventListener('click', () => logModal.style.display = 'none');
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

function updateScreenshotPreview(dataURL) {
    const preview = document.getElementById('photoPreview');
    preview.src = dataURL;
    preview.style.display = 'block';
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

