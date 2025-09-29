import * as THREE from 'three';
import { getScene, getController, getReticle, isModelPlaced, setModelPlaced, getModel, getAlignmentState, setAlignmentState, alignModelWithPoints } from './main.js';
import { getSelectedObject, selectObject, deselectAll } from './model.js';
import { showInfo, openDefectEditor, setStatusText, updatePositionSliders } from './ui.js';

let tapTimer = null;
let lastTapTime = 0;
const LONG_PRESS_THRESHOLD = 500;
const DOUBLE_TAP_THRESHOLD = 300;

export const defectLog = [];

let floorMatrix = null;
let wallMatrix = null;

export function startAlignmentProcess() {
    if (!getModel()) {
        alert("Сначала загрузите модель.");
        return;
    }
    setModelPlaced(false);
    
    // Reset alignment matrices
    floorMatrix = null;
    wallMatrix = null;
    
    setAlignmentState('waitingForFloor');
    setStatusText('Наведите на пол и коснитесь экрана');
    
    // Reticle is now used for alignment aiming
    getReticle().visible = true; 
}

function placeModelOnReticle() {
    const model = getModel();
    const reticle = getReticle();
    if (!isModelPlaced() && reticle.visible && model) {
        model.position.setFromMatrixPosition(reticle.matrix);

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
        
        setStatusText('Модель размещена. Взаимодействуйте с ней.');
        updatePositionSliders();
        
        const toolbar = document.getElementById('toolbar');
        if(toolbar) toolbar.style.display = 'flex';
    }
}

function performAlignmentStep() {
    const reticle = getReticle();
    if (!reticle.visible) {
        // Can't align if we don't have a valid hit-test point
        setStatusText('Не удалось найти поверхность. Попробуйте еще раз.');
        return;
    }

    const alignmentState = getAlignmentState();
    
    if (alignmentState === 'waitingForFloor') {
        floorMatrix = reticle.matrix.clone();
        setStatusText('Отлично! Теперь коснитесь основной стены.');
        setAlignmentState('waitingForWall');

    } else if (alignmentState === 'waitingForWall') {
        wallMatrix = reticle.matrix.clone();
        setStatusText('Стена выбрана. Выравниваю модель...');
        alignModelWithPoints(floorMatrix, wallMatrix);
    }
}

export function onSelectStart(event) {
    const controller = event.target;
    const currentTime = performance.now();

    // Only set up timers for interaction if a model is fully placed and we are not aligning
    if (isModelPlaced() && getAlignmentState() === 'idle') {
        tapTimer = setTimeout(() => {
            handleLongPress(controller);
            tapTimer = null;
        }, LONG_PRESS_THRESHOLD);

        if (currentTime - lastTapTime < DOUBLE_TAP_THRESHOLD) {
            if (tapTimer) clearTimeout(tapTimer);
            tapTimer = null;
            handleDoubleClick(controller);
        }
        lastTapTime = currentTime;
    }
}

export function onSelectEnd() {
    // This handles single taps
    if (isModelPlaced() && getAlignmentState() === 'idle') {
        if (tapTimer) {
            clearTimeout(tapTimer);
            tapTimer = null;
            // Short tap on placed model does nothing for now
        }
    } else if (getAlignmentState() !== 'idle') {
        performAlignmentStep();
    } else {
        placeModelOnReticle();
    }
}


function handleDoubleClick(controller) {
    const intersectedObject = getIntersectedObject(controller);
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

function handleLongPress(controller) {
    console.log("Long press detected!");
    const raycaster = new THREE.Raycaster();
    raycaster.setFromXRController(controller);
    const model = getModel();
    if (!model) return;

    const intersects = raycaster.intersectObject(model, true);

    if (intersects.length > 0) {
        const intersection = intersects[0];
        const intersectedComponent = getIntersectedObject(controller, intersection.object);

        addDefectMarker(
            intersection,
            intersectedComponent ? intersectedComponent.userData.GlobalId : null
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
            normal: intersection.face ? intersection.face.normal.clone() : null,
        },
        attachedGlobalId: globalId,
        description: '', type: '', criticality: '', photo: ''
    };
    marker.defectId = defect.id;
    getScene().add(marker);
    defectLog.push(defect);

    openDefectEditor(defect);
}

function getIntersectedObject(controller, initialObject = null) {
    const model = getModel();
    if (!model) return null;
    if (!initialObject) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromXRController(controller);
        const intersects = raycaster.intersectObject(model, true);
        if (intersects.length === 0) return null;
        initialObject = intersects[0].object;
    }

    let current = initialObject;
    while (current) {
        if (current.userData.GlobalId) return current;
        current = current.parent;
    }
    return null;
}

