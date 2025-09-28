import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Vector3
} from 'three';

class DecalGeometry extends BufferGeometry {

  constructor( mesh, position, orientation, size ) {

    super();

    // buffers
    const vertices = [];
    const normals = [];
    const uvs = [];

    // helpers
    const plane = new Vector3();

    const projector = new Matrix4();
    projector.makeRotationFromEuler( orientation );
    projector.setPosition( position );

    const projectorInverse = new Matrix4();
    projectorInverse.copy( projector ).invert();

    //
    this.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ) );
    this.setAttribute( 'normal', new Float32BufferAttribute( normals, 3 ) );
    this.setAttribute( 'uv', new Float32BufferAttribute( uvs, 2 ) );

    const pA = new Vector3();
    const pB = new Vector3();
    const pC = new Vector3();

    const nA = new Vector3();
    const nB = new Vector3();
    const nC = new Vector3();

    const vA = new Vector3();
    const vB = new Vector3();
    const vC = new Vector3();

    check( mesh );

    function check( object ) {

      if ( object.isMesh ) {

        if ( object.visible === false ) return;

        const geometry = object.geometry;
        const positionAttribute = geometry.attributes.position;
        const normalAttribute = geometry.attributes.normal;

        if ( positionAttribute === undefined || normalAttribute === undefined ) return;

        //

        const matrixWorld = object.matrixWorld;

        if ( geometry.index ) {

          const index = geometry.index;

          for ( let i = 0; i < index.count; i += 3 ) {

            const a = index.getX( i );
            const b = index.getX( i + 1 );
            const c = index.getX( i + 2 );

            pA.fromBufferAttribute( positionAttribute, a );
            pB.fromBufferAttribute( positionAttribute, b );
            pC.fromBufferAttribute( positionAttribute, c );

            pA.applyMatrix4( matrixWorld );
            pB.applyMatrix4( matrixWorld );
            pC.applyMatrix4( matrixWorld );

            nA.fromBufferAttribute( normalAttribute, a );
            nB.fromBufferAttribute( normalAttribute, b );
            nC.fromBufferAttribute( normalAttribute, c );

            nA.transformDirection( matrixWorld );
            nB.transformDirection( matrixWorld );
            nC.transformDirection( matrixWorld );

            pushDecal( pA, pB, pC, nA, nB, nC );

          }

        } else {

          for ( let i = 0; i < positionAttribute.count; i += 3 ) {

            pA.fromBufferAttribute( positionAttribute, i );
            pB.fromBufferAttribute( positionAttribute, i + 1 );
            pC.fromBufferAttribute( positionAttribute, i + 2 );

            pA.applyMatrix4( matrixWorld );
            pB.applyMatrix4( matrixWorld );
            pC.applyMatrix4( matrixWorld );

            nA.fromBufferAttribute( normalAttribute, i );
            nB.fromBufferAttribute( normalAttribute, i + 1 );
            nC.fromBufferAttribute( normalAttribute, i + 2 );

            nA.transformDirection( matrixWorld );
            nB.transformDirection( matrixWorld );
            nC.transformDirection( matrixWorld );

            pushDecal( pA, pB, pC, nA, nB, nC );

          }

        }

      }

      if ( object.isGroup ) {

        for ( let i = 0; i < object.children.length; i ++ ) {

          check( object.children[ i ] );

        }

      }

    }

    function pushDecal( pA, pB, pC, nA, nB, nC ) {

      // normal of the decal polygon.
      const normal = nA.clone().add( nB ).add( nC ).normalize();

      // 1. projecting vertices on the plane of the decal
      plane.copy( normal );
      plane.negate();
      const distance = plane.dot( position );

      vA.copy( pA ).addScaledVector( plane, distance - plane.dot( pA ) );
      vB.copy( pB ).addScaledVector( plane, distance - plane.dot( pB ) );
      vC.copy( pC ).addScaledVector( plane, distance - plane.dot( pC ) );

      // 2. transforming vertices to decal space
      vA.applyMatrix4( projectorInverse );
      vB.applyMatrix4( projectorInverse );
      vC.applyMatrix4( projectorInverse );

      // 3. cliping
      const S = 0.5 * Math.abs( size.x );

      if ( Math.abs( vA.x ) > S || Math.abs( vA.y ) > S ||
         Math.abs( vB.x ) > S || Math.abs( vB.y ) > S ||
         Math.abs( vC.x ) > S || Math.abs( vC.y ) > S ) {

        return; // triangle is outside the decal sphere.

      }

      // 4. adding vertices
      vertices.push( vA.x, vA.y, vA.z );
      vertices.push( vB.x, vB.y, vB.z );
      vertices.push( vC.x, vC.y, vC.z );

      // 5. adding normals
      normals.push( normal.x, normal.y, normal.z );
      normals.push( normal.x, normal.y, normal.z );
      normals.push( normal.x, normal.y, normal.z );

      // 6. adding uvs
      uvs.push( 0.5 + vA.x / size.x, 0.5 + vA.y / size.y );
      uvs.push( 0.5 + vB.x / size.x, 0.5 + vB.y / size.y );
      uvs.push( 0.5 + vC.x / size.x, 0.5 + vC.y / size.y );
    }

  }

}

export { DecalGeometry };

