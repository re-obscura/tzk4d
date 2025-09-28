import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { setupUIListeners } from './ui.js';
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

// --- Debug ---
const debugPlanes = new Map();
const debugPlanesGroup = new THREE.Group();
debugPlanesGroup.name = "debugPlanesGroup";

// --- Getters and Setters ---
export const getScene = () => scene;
export const getRenderer = () => renderer;
export const getController = () => controller;
export const getReticle = () => reticle;
export const getDebugPlanes = () => debugPlanes;
export const getDebugPlanesGroup = () => debugPlanesGroup;
export const isModelPlaced = () => modelPlaced;
export const setModelPlaced = (value) => { modelPlaced = value; };
export const getModel = () => model;
export const getBimData = () => bimData;


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
    debugPlanesGroup.visible = false;
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

async function loadFile(file) {
    document.getElementById('statusText').textContent = 'Загрузка модели...';
    try {
        const loadedData = await handleZipFile(file);

        if (model) {
            scene.remove(model);
        }

        model = loadedData.model;
        bimData = loadedData.bimData;

        setModelPlaced(false);
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

function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (debugPlanesGroup.visible && frame.detectedPlanes) {
            const detectedPlanes = frame.detectedPlanes;
                        const currentPlaneIds = new Set();

                        detectedPlanes.forEach(plane => {
                            currentPlaneIds.add(plane);
                            let planeMesh = debugPlanes.get(plane);

                            if (!planeMesh) {
                                const pose = frame.getPose(plane.planeSpace, referenceSpace);
                                if (pose) {
                                    const planeGeometry = new THREE.PlaneGeometry(1, 1);
                                    planeMesh = new THREE.Mesh(planeGeometry, debugPlaneMaterial);

                                    debugPlanes.set(plane, planeMesh);
                                    debugPlanesGroup.add(planeMesh);
                                }
                            }

                            if(planeMesh) {
                                const pose = frame.getPose(plane.planeSpace, referenceSpace);
                                if (pose) {
                                    planeMesh.position.copy(pose.transform.position);
                                    planeMesh.quaternion.copy(pose.transform.orientation);
                                }
                            }
                        });

                        debugPlanes.forEach((mesh, plane) => {
                            if (!currentPlaneIds.has(plane)) {
                                debugPlanesGroup.remove(mesh);
                                debugPlanes.delete(plane);
                            }
                        });
        }

        if (!modelPlaced) {
            if (hitTestSourceRequested === false) {
                session.requestReferenceSpace('viewer').then(function (referenceSpace) {
                    session.requestHitTestSource({ space: referenceSpace }).then(function (source) {
                        hitTestSource = source;
                    });
                });
                session.addEventListener('end', () => {
                    hitTestSourceRequested = false;
                    hitTestSource = null;
                });
                hitTestSourceRequested = true;
            }

            if (hitTestSource) {
                const hitTestResults = frame.getHitTestResults(hitTestSource);
                if (hitTestResults.length) {
                    const hit = hitTestResults[0];
                    reticle.visible = true;
                    reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
                } else {
                    reticle.visible = false;
                }
            }
        }
    }

    renderer.render(scene, camera);
}

