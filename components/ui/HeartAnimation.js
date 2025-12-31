"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";

export default function HeartAnimation() {
  const containerRef = useRef();

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      5000
    );
    camera.position.z = 400; // smaller zoom for small heart

    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight
    );
    containerRef.current.appendChild(renderer.domElement);

    const tl = gsap.timeline({ repeat: -1, yoyo: true });

    // Heart path
    const svgPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    svgPath.setAttribute(
      "d",
      "M300,107.77C284.68,55.67,239.76,0,162.31,0,64.83,0,0,82.08,0,171.71c0,.48,0,.95,0,1.43-.52,19.5,0,217.94,299.87,379.69v0l0,0,.05,0,0,0,0,0v0C600,391.08,600.48,192.64,600,173.14c0-.48,0-.95,0-1.43C600,82.08,535.17,0,437.69,0,360.24,0,315.32,55.67,300,107.77"
    );

    const length = svgPath.getTotalLength();
    const vertices = [];

    // ⚡ fewer points, smaller heart
    for (let i = 0; i < length; i +=4) {
      const point = svgPath.getPointAtLength(i);
      const vector = new THREE.Vector3(point.x * 0.35, -point.y * 0.35, 0); // scaled down
      vector.x += (Math.random() - 0.5) * 10;
      vector.y += (Math.random() - 0.5) * 10;
      vector.z += (Math.random() - 0.5) * 30;
      vertices.push(vector);
      tl.from(
        vector,
        {
          x: 100,
          y: -100,
          z: 0,
          ease: "power2.inOut",
          duration: Math.random() * 4 + 3,
        },
        i * 0.002
      );
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
    const material = new THREE.PointsMaterial({
      color: 0xe91e63, // pink
      blending: THREE.AdditiveBlending,
      size: 2, // smaller dots
    });

    const particles = new THREE.Points(geometry, material);
    particles.position.x -= 100;
    particles.position.y += 100;
    scene.add(particles);

    gsap.fromTo(
      scene.rotation,
      { y: -0.15 },
      { y: 0.15, repeat: -1, yoyo: true, ease: "power2.inOut", duration: 3 }
    );

    const render = () => {
      geometry.setFromPoints(vertices);
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    };
    render();

    const handleResize = () => {
      camera.aspect =
        containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ zIndex: 0, pointerEvents: "none" }}
    />
  );
}
