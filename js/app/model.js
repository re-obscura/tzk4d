import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { getScene } from './main.js';

let currentModel, currentBimData;
let selectedObject = null;
const highlightMaterial = new THREE.MeshLambertMaterial({ color: 0x007AFF, emissive: 0x007AFF });
const textureLoader = new THREE.TextureLoader();

export const getModel = () => currentModel;
export const getBimData = () => currentBimData;
export const getSelectedObject = () => selectedObject;

export function setModelOpacity(obj, opacity) {
    obj.traverse(child => {
        if (child.isMesh) {
            if (!child.userData.originalMaterial) {
                child.userData.originalMaterial = child.material;
            }
            const material = child.userData.originalMaterial;
            material.transparent = opacity < 1.0;
            material.opacity = opacity;
        }
    });
}

export function selectObject(objectToSelect) {
    selectedObject = objectToSelect;
    currentModel.traverse(child => {
        if (child.isMesh) {
            if (!child.userData.originalMaterial) {
                child.userData.originalMaterial = child.material;
            }

            let isSelected = false;
            let parent = child;
            while(parent) {
                if (parent.uuid === objectToSelect.uuid) {
                    isSelected = true;
                    break;
                }
                parent = parent.parent;
            }

            if (isSelected) {
                child.material = highlightMaterial;
            } else {
                const material = child.userData.originalMaterial;
                if (material.userData.originalOpacity === undefined) {
                    material.userData.originalOpacity = material.opacity;
                    material.userData.originalTransparent = material.transparent;
                }
                material.transparent = true;
                material.opacity = 0.1;
                child.material = material;
            }
        }
    });
}

export function deselectAll() {
    if (!selectedObject) return;
    selectedObject = null;
    currentModel.traverse(child => {
        if (child.isMesh && child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial;

            const originalMaterial = child.userData.originalMaterial;
            if (originalMaterial.userData.originalOpacity !== undefined) {
                originalMaterial.opacity = originalMaterial.userData.originalOpacity;
                originalMaterial.transparent = originalMaterial.userData.originalTransparent;
            }
        }
    });
}

function centerModel(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);
}

export function handleZipFile(file) {
    return new Promise((resolve, reject) => {
        if (selectedObject) {
            deselectAll();
        }

        const loader = new GLTFLoader();
        JSZip.loadAsync(file).then(zip => {
            let glbFile = null;
            let jsonFile = null;

            zip.forEach((relativePath, zipEntry) => {
                if (relativePath.toLowerCase().endsWith('.glb')) {
                    glbFile = zipEntry;
                } else if (relativePath.toLowerCase().endsWith('_data.json')) {
                    jsonFile = zipEntry;
                }
            });

            if (!glbFile || !jsonFile) {
                return reject(new Error("Архив должен содержать .glb и _data.json файлы."));
            }

            const glbPromise = glbFile.async('arraybuffer').then(glbData => {
                const blob = new Blob([glbData]);
                const url = URL.createObjectURL(blob);
                return new Promise((resolveLoad, rejectLoad) => {
                    loader.load(url, gltf => {
                        URL.revokeObjectURL(url);
                        resolveLoad(gltf);
                    }, undefined, rejectLoad);
                });
            });

            const jsonPromise = jsonFile.async('string').then(JSON.parse);

            Promise.all([glbPromise, jsonPromise]).then(([gltf, bimData]) => {
                currentModel = gltf.scene;
                currentBimData = bimData;

                gltf.parser.json.nodes.forEach((node) => {
                    const association = gltf.parser.associations.get(node);
                    if (node.extras && node.extras.GlobalId && association) {
                        const mesh = currentModel.getObjectByProperty('uuid', association.uuid);
                        if (mesh) {
                            mesh.userData.GlobalId = node.extras.GlobalId;
                        }
                    }
                });

                centerModel(currentModel);
                resolve({ model: currentModel, bimData: currentBimData });
            }).catch(reject);

        }).catch(reject);
    });
}

export function applyDecal(intersection, textureDataURL) {
    const { point, object, normal } = intersection;

    textureLoader.load(textureDataURL, (texture) => {
        const decalSize = new THREE.Vector3(0.5, 0.5, 0.5);

        const orientation = new THREE.Euler();
        const worldNormal = new THREE.Vector3().copy(normal).transformDirection(object.matrixWorld).normalize();

        const up = (Math.abs(worldNormal.y) < 0.99) ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
        const rotationMatrix = new THREE.Matrix4().lookAt(point, point.clone().add(worldNormal), up);
        orientation.setFromRotationMatrix(rotationMatrix);

        const decalMaterial = new THREE.MeshPhongMaterial({
            map: texture,
            specular: 0x444444,
            shininess: 30,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -4,
        });

        const decalGeometry = new DecalGeometry(object, point, orientation, decalSize);
        const decalMesh = new THREE.Mesh(decalGeometry, decalMaterial);
        decalMesh.name = "decal";

        getScene().add(decalMesh);
        console.log("Decal applied to model.");
    });
}

