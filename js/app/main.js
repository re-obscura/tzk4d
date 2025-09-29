import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { setupUIListeners, setStatusText, updatePositionSliders } from './ui.js';
import { handleZipFile } from './model.js';
import { onSelectStart, onSelectEnd } from './interactions.js';

// --- State and Scene variables ---
let camera, scene, renderer;
let controller;
let reticle;
let hitTestSource = null, hitTestSourceRequested = false;
let model, bimData;
let modelPlaced = false;
let arButton;

// --- Alignment variables ---
let alignmentState = 'idle'; // idle, waitingForFloor, waitingForWall
let detectedPlanes = new Map();

// --- State variables for model restoration on session restart ---
let arRestartRequested = false;
let shouldRestoreModel = false;
const lastModelPosition = new THREE.Vector3();
const lastModelQuaternion = new THREE.Quaternion();

// --- Debug ---
const debugPlanesGroup = new THREE.Group();
debugPlanesGroup.name = "debugPlanesGroup";

// --- Getters and Setters ---
export const getScene = () => scene;
export const getRenderer = () => renderer;
export const getController = () => controller;
export const getReticle = () => reticle;
export const getDebugPlanesGroup = () => debugPlanesGroup;
export const isModelPlaced = () => modelPlaced;
export const setModelPlaced = (value) => { modelPlaced = value; };
export const getModel = () => model;
export const getBimData = () => bimData;
// Alignment getters/setters
export const getAlignmentState = () => alignmentState;
export const setAlignmentState = (state) => { alignmentState = state; };
export const getDetectedPlanes = () => detectedPlanes;

// --- Function to request AR restart and save model state ---
export function requestARRestart() {
    if (model && modelPlaced) {
        console.log("Saving model state before AR session exit.");
        lastModelPosition.copy(model.position);
        lastModelQuaternion.copy(model.quaternion);
        shouldRestoreModel = true;
    }
    arRestartRequested = true;
}

init();
animate();

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 2);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    scene.add(debugPlanesGroup);
    debugPlanesGroup.visible = false; // Initially hidden

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    arButton = ARButton.createButton(renderer, {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'plane-detection'],
        domOverlay: { root: document.querySelector('.ui-container') }
    });
    arButton.style.display = 'none';
    document.body.appendChild(arButton);

    renderer.xr.addEventListener('sessionend', onSessionEnd);

    setupUIListeners(renderer, loadFile, () => arButton.click());

    controller = renderer.xr.getController(0);
    controller.addEventListener('selectstart', onSelectStart);
    controller.addEventListener('selectend', onSelectEnd);
    scene.add(controller);

    reticle = new THREE.Mesh( new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial());
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    window.addEventListener('resize', onWindowResize);
}

function onSessionEnd() {
    console.log("AR Session Ended.");
    hitTestSourceRequested = false;
    hitTestSource = null;
    setModelPlaced(false);
    reticle.visible = false;
    alignmentState = 'idle';

    detectedPlanes.forEach((planeObject) => debugPlanesGroup.remove(planeObject.mesh));
    detectedPlanes.clear();

    if (model && !shouldRestoreModel) {
        model.visible = false;
    }

    if (arRestartRequested) {
        console.log("Requesting AR session restart.");
        arRestartRequested = false;
        setTimeout(() => arButton.click(), 100);
    }
}


async function loadFile(file) {
    setStatusText('Загрузка модели...');
    try {
        const loadedData = await handleZipFile(file);
        if (model) scene.remove(model);
        model = loadedData.model;
        bimData = loadedData.bimData;
        setModelPlaced(false);
        shouldRestoreModel = false;
    } catch (error) {
        console.error("Failed to load file:", error);
        alert("Ошибка при загрузке файла. Проверьте консоль для деталей.");
    }
}

function onWindowResize() {
    if (renderer.xr.isPresenting) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    renderer.setAnimationLoop(render);
}

export function alignModelWithPoints(floorMatrix, wallMatrix) {
    if (!model || !floorMatrix || !wallMatrix) return;

    // 1. Get position from matrices
    const floorPoint = new THREE.Vector3().setFromMatrixPosition(floorMatrix);
    const wallPoint = new THREE.Vector3().setFromMatrixPosition(wallMatrix);

    // Set model position: X and Z from wall hit, Y from floor hit.
    model.position.set(wallPoint.x, floorPoint.y, wallPoint.z);

    // 2. Get rotation from the wall hit matrix
    // The hit-test pose is oriented with +Y up, and +Z pointing into the surface.
    const wallRotationMatrix = new THREE.Matrix4().extractRotation(wallMatrix);
    const wallNormal = new THREE.Vector3(0, 0, 1).applyMatrix4(wallRotationMatrix);

    // We want the model's forward (+Z) to point away from the wall normal.
    const lookDirection = wallNormal.clone().negate();

    // Project the look direction onto the horizontal plane (our virtual floor)
    lookDirection.y = 0;
    lookDirection.normalize();

    // The model's default forward direction is +Z
    const modelForward = new THREE.Vector3(0, 0, 1);

    // Calculate the quaternion needed to rotate the model's forward to our look direction
    const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(modelForward, lookDirection);
    model.quaternion.copy(targetQuaternion);

    // 3. Finalize placement
    if (!model.parent) getScene().add(model);
    model.visible = true;
    setModelPlaced(true);
    reticle.visible = false;
    setStatusText('Модель выровнена. Используйте настройки для точной подгонки.');
    updatePositionSliders();
    setAlignmentState('idle');
    getDebugPlanesGroup().visible = false;
}


function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        // Plane visualization is for debug purposes only now
        if (session.enabledFeatures?.includes('plane-detection')) {
            const planes = frame.detectedPlanes;
            if (planes) {
                const currentPlaneIds = new Set();
                planes.forEach(plane => {
                    currentPlaneIds.add(plane);
                    let planeObject = detectedPlanes.get(plane);
                    
                    if (!planeObject) {
                        const planeGeometry = new THREE.PlaneGeometry(2, 2); 
                        const debugMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.2, side: THREE.DoubleSide, wireframe: true });
                        const mesh = new THREE.Mesh(planeGeometry, debugMaterial);
                        planeObject = { mesh, plane };
                        detectedPlanes.set(plane, planeObject);
                        debugPlanesGroup.add(mesh);
                    }

                    const pose = frame.getPose(plane.planeSpace, referenceSpace);
                    if (pose) {
                       planeObject.mesh.matrix.fromArray(pose.transform.matrix);
                    }
                });

                detectedPlanes.forEach((planeObject, plane) => {
                    if (!currentPlaneIds.has(plane)) {
                        debugPlanesGroup.remove(planeObject.mesh);
                        detectedPlanes.delete(plane);
                    }
                });
            }
        }


        if (!modelPlaced) {
            if (shouldRestoreModel && model) {
                console.log("Restoring model position.");
                model.position.copy(lastModelPosition);
                model.quaternion.copy(lastModelQuaternion);
                if (!model.parent) scene.add(model);
                model.visible = true;
                setModelPlaced(true);
                shouldRestoreModel = false;
                reticle.visible = false;
                setStatusText('Модель восстановлена.');
            } else { // This block now handles both standard placement and alignment steps
                if (hitTestSourceRequested === false && session) {
                    session.requestReferenceSpace('viewer').then(function (referenceSpace) {
                        session.requestHitTestSource({ space: referenceSpace }).then(function (source) {
                            hitTestSource = source;
                        });
                    });
                    hitTestSourceRequested = true;
                }

                if (hitTestSource) {
                    const hitTestResults = frame.getHitTestResults(hitTestSource);
                    if (hitTestResults.length) {
                        const hit = hitTestResults[0];
                        // Only show reticle if we are placing or aligning
                        if (alignmentState !== 'idle' || !isModelPlaced()) {
                           reticle.visible = true;
                           reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
                        } else {
                           reticle.visible = false;
                        }
                        if(model && !model.parent) model.visible = false;
                    } else {
                        reticle.visible = false;
                    }
                }
            }
        }
    }

    renderer.render(scene, camera);
}

