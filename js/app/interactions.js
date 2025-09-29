import * as THREE from 'three';
import { getScene, getController, getReticle, isModelPlaced, setModelPlaced, getModel } from './main.js';
import { getSelectedObject, selectObject, deselectAll } from './model.js';
import { showInfo, openDefectEditor } from './ui.js';

let tapTimer = null;
let lastTapTime = 0;
const LONG_PRESS_THRESHOLD = 500;
const DOUBLE_TAP_THRESHOLD = 300;

export const defectLog = [];

export function onSelectStart() {
    const currentTime = performance.now();

    tapTimer = setTimeout(() => {
        handleLongPress();
        tapTimer = null;
    }, LONG_PRESS_THRESHOLD);

    if (currentTime - lastTapTime < DOUBLE_TAP_THRESHOLD) {
        clearTimeout(tapTimer);
        tapTimer = null;
        handleDoubleClick();
    }
    lastTapTime = currentTime;
}

export function onSelectEnd() {
    if (tapTimer) {
        clearTimeout(tapTimer);
        handleSingleClick();
    }
}

function handleSingleClick() {
    const model = getModel();
    const reticle = getReticle();
    if (!isModelPlaced() && reticle.visible && model) {
        model.position.setFromMatrixPosition(reticle.matrix);

        // Make model 4x smaller to solve scaling issue. This can be adjusted in settings.
        const initialScale = 0.25;
        model.scale.set(initialScale, initialScale, initialScale);

        const modelScaleSlider = document.getElementById('modelScaleSlider');
        const modelScaleLabel = document.getElementById('modelScaleLabel');
        if (modelScaleSlider && modelScaleLabel) {
            modelScaleSlider.value = initialScale;
            modelScaleLabel.textContent = `Масштаб модели: ${Math.round(initialScale * 100)}%`;
        }

        getScene().add(model);
        setModelPlaced(true);
        reticle.visible = false;
        
        const statusText = document.getElementById('statusText');
        if (statusText) statusText.textContent = 'Модель размещена. Взаимодействуйте с ней.';
        
        const fileInputLabel = document.querySelector('.file-input-label');
        if (fileInputLabel) fileInputLabel.parentElement.style.display = 'none';
        
        const toolbar = document.getElementById('toolbar');
        if(toolbar) toolbar.style.display = 'flex';
    }
}

function handleDoubleClick() {
    const intersectedObject = getIntersectedObject();
    if (!intersectedObject) {
        deselectAll();
        return;
    }

    showInfo(intersectedObject.userData.GlobalId);

    const selectedObject = getSelectedObject();
    if (selectedObject && selectedObject.uuid === intersectedObject.uuid) {
        deselectAll();
    } else {
        deselectAll();
        selectObject(intersectedObject);
    }
}

function handleLongPress() {
    console.log("Long press detected!");
    const raycaster = new THREE.Raycaster();
    raycaster.setFromXRController(getController());
    const model = getModel();
    if (!model) return;

    const intersects = raycaster.intersectObject(model, true);

    if (intersects.length > 0) {
        const intersection = intersects[0];
        const intersectedObject = getIntersectedObject(intersection.object);

        addDefectMarker(
            intersection,
            intersectedObject ? intersectedObject.userData.GlobalId : null
        );
    }
}

function addDefectMarker(intersection, globalId = null) {
    const markerGeometry = new THREE.SphereGeometry(0.05);
    const marker = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    marker.position.copy(intersection.point);

    const defect = {
        id: Date.now(),
        intersection: {
            point: intersection.point.clone(),
            object: intersection.object,
            normal: intersection.face.normal.clone(),
        },
        attachedGlobalId: globalId,
        description: '', type: '', criticality: '', photo: ''
    };
    marker.defectId = defect.id;
    getScene().add(marker);
    defectLog.push(defect);

    openDefectEditor(defect);
}

function getIntersectedObject(initialObject = null) {
    const model = getModel();
    if (!model) return null;
    if (!initialObject) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromXRController(getController());
        const intersects = raycaster.intersectObject(model, true);
        if (intersects.length === 0) return null;
        initialObject = intersects[0].object;
    }

    while (initialObject) {
        if (initialObject.userData.GlobalId) return initialObject;
        initialObject = initialObject.parent;
    }
    return null;
}
