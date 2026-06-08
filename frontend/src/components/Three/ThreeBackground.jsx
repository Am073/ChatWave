import { useEffect, useRef } from 'react';

export default function ThreeBackground() {
  const containerRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    let renderer, camera, scene;

    const init = async () => {
      try {
        const THREE = await import('three');

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(
          75,
          window.innerWidth / window.innerHeight,
          0.1,
          1000
        );
        camera.position.z = 5;

        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true
        });
        renderer.setSize(
          window.innerWidth,
          window.innerHeight
        );
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(
          window.devicePixelRatio
        );

        if (containerRef.current) {
          containerRef.current.appendChild(
            renderer.domElement
          );
        }

        // Particles
        const positions = new Float32Array(
          200 * 3
        );
        for (let i = 0; i < 200 * 3; i++) {
          positions[i] =
            (Math.random() - 0.5) * 40;
        }
        const particleGeo =
          new THREE.BufferGeometry();
        particleGeo.setAttribute(
          'position',
          new THREE.BufferAttribute(
            positions, 3
          )
        );
        const particleMat =
          new THREE.PointsMaterial({
            size: 0.06,
            color: 0xffffff,
            transparent: true,
            opacity: 0.4
          });
        const particles =
          new THREE.Points(
            particleGeo, particleMat
          );
        scene.add(particles);

        // Orb
        const orbGeo =
          new THREE.SphereGeometry(
            1.4, 32, 32
          );
        const orbMat =
          new THREE.MeshPhongMaterial({
            color: 0x1d4ed8,
            emissive: 0x0d9488,
            emissiveIntensity: 0.3,
            shininess: 80
          });
        const orb = new THREE.Mesh(
          orbGeo, orbMat
        );
        scene.add(orb);

        // Lights
        const ambient =
          new THREE.AmbientLight(
            0xffffff, 0.4
          );
        const point =
          new THREE.PointLight(
            0x3b82f6, 3, 15
          );
        point.position.set(3, 3, 3);
        scene.add(ambient, point);

        // Resize handler
        const onResize = () => {
          camera.aspect =
            window.innerWidth /
            window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(
            window.innerWidth,
            window.innerHeight
          );
        };
        window.addEventListener(
          'resize', onResize
        );

        // Animation loop
        let frame = 0;
        const animate = () => {
          animFrameRef.current =
            requestAnimationFrame(animate);
          frame += 0.01;
          particles.rotation.y += 0.0004;
          particles.rotation.x += 0.0002;
          orb.rotation.y += 0.008;
          orb.rotation.x += 0.003;
          point.position.x =
            Math.sin(frame) * 4;
          point.position.z =
            Math.cos(frame) * 4;
          renderer.render(scene, camera);
        };
        animate();

        return () => {
          window.removeEventListener(
            'resize', onResize
          );
        };
      } catch (err) {
        console.error(
          'ThreeBackground error:', err
        );
      }
    };

    init();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(
          animFrameRef.current
        );
      }
      if (renderer) {
        renderer.dispose();
        if (
          containerRef.current &&
          renderer.domElement &&
          containerRef.current.contains(
            renderer.domElement
          )
        ) {
          containerRef.current.removeChild(
            renderer.domElement
          );
        }
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  );
}
