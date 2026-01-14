import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';

const NeonRunner = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('menu'); // menu, playing, gameOver, levelComplete
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [level, setLevel] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const gameLoopRef = useRef(null);
  const audioContextRef = useRef(null);
  const musicRef = useRef({ playing: false, oscillators: [], gains: [] });

  // Game state refs
  const playerRef = useRef({ x: 100, y: 300, width: 30, height: 40, velocityY: 0, isJumping: false });
  const obstaclesRef = useRef([]);
  const dronesRef = useRef([]);
  const nodesRef = useRef([]);
  const backgroundRef = useRef({ offset: 0 });
  const frameCountRef = useRef(0);
  const glitchRef = useRef({ active: false, intensity: 0 });

  // Audio synthesis
  const startMusic = () => {
    // Music disabled for now
    return;
  };
  
  const stopMusic = () => {
    // Music disabled for now
    return;
  };

  const playSound = (type) => {
    if (!soundEnabled) return;
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    switch(type) {
      case 'jump':
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
        break;
      case 'collect':
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
        break;
      case 'hit':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
        break;
    }
  };

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setCoinsCollected(0);
    playerRef.current = { x: 100, y: 300, width: 30, height: 40, velocityY: 0, isJumping: false };
    obstaclesRef.current = [];
    dronesRef.current = [];
    nodesRef.current = [];
    backgroundRef.current = { offset: 0 };
    frameCountRef.current = 0;
    glitchRef.current = { active: false, intensity: 0 };
  };

  const restartGame = () => {
    setLevel(1);
    startGame();
  };

  const nextLevel = () => {
    setLevel(level + 1);
    setGameState('playing');
    setScore(0);
    setCoinsCollected(0);
    playerRef.current = { x: 100, y: 300, width: 30, height: 40, velocityY: 0, isJumping: false };
    obstaclesRef.current = [];
    dronesRef.current = [];
    nodesRef.current = [];
    backgroundRef.current = { offset: 0 };
    frameCountRef.current = 0;
    glitchRef.current = { active: false, intensity: 0 };
  };

  const gameOver = () => {
    setGameState('gameOver');
    if (score > highScore) {
      setHighScore(score);
    }
    playSound('hit');
    stopMusic();
  };

  const levelComplete = () => {
    setGameState('levelComplete');
    if (score > highScore) {
      setHighScore(score);
    }
    stopMusic();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Start music when gameplay begins
    if (gameState === 'playing' && soundEnabled) {
      startMusic();
    } else if (gameState !== 'playing') {
      stopMusic();
    }
    
    const ctx = canvas.getContext('2d');
    const GRAVITY = 0.6;
    const JUMP_FORCE = -15;
    const GROUND_Y = 340;
    const GAME_SPEED = 5 + (level - 1) * 1.5; // Speed increases with level

    const spawnObstacle = () => {
      const types = ['barrier', 'spike', 'block'];
      const type = types[Math.floor(Math.random() * types.length)];
      obstaclesRef.current.push({
        x: canvas.width,
        y: type === 'spike' ? GROUND_Y + 10 : GROUND_Y - 30,
        width: type === 'barrier' ? 20 : 40,
        height: type === 'spike' ? 30 : type === 'barrier' ? 50 : 40,
        type
      });
    };

    const spawnDrone = () => {
      // Check if there's a recent obstacle that could conflict
      const recentObstacles = obstaclesRef.current.filter(obs => 
        obs.x > canvas.width - 250 && obs.x < canvas.width + 250
      );
      
      // If there's an obstacle nearby, don't spawn drone
      if (recentObstacles.length > 0) {
        return; // Skip spawning this drone
      }
      
      dronesRef.current.push({
        x: canvas.width,
        y: GROUND_Y - 120, // Fixed at jump height
        width: 50,
        height: 30,
        phase: Math.random() * Math.PI * 2
      });
    };

    const spawnNode = () => {
      // Check for nearby obstacles with a larger buffer
      const recentObstacles = obstaclesRef.current.filter(obs => 
        obs.x > canvas.width - 200 && obs.x < canvas.width + 200
      );
      
      // 80% chance: spawn over an obstacle (if one exists nearby)
      // 20% chance: spawn on the ground (only if no obstacles nearby)
      if (recentObstacles.length > 0 && Math.random() > 0.2) {
        // Spawn directly above the obstacle at jump height
        const obstacle = recentObstacles[0];
        nodesRef.current.push({
          x: obstacle.x + obstacle.width / 2,
          y: GROUND_Y - 120, // At mid-jump height where player can easily collect
          size: 15,
          pulse: 0
        });
      } else if (recentObstacles.length === 0) {
        // Only spawn ground coins when there are NO obstacles nearby
        nodesRef.current.push({
          x: canvas.width,
          y: GROUND_Y - 10,
          size: 15,
          pulse: 0
        });
      }
      // If obstacles exist but we didn't place coin above them, skip this spawn
    };

    const drawNeonText = (text, x, y, size, color, glowIntensity = 20) => {
      ctx.font = `bold ${size}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.shadowColor = color;
      ctx.shadowBlur = glowIntensity;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      ctx.shadowBlur = 0;
    };

    const drawBackground = () => {
      // Dark gradient sky with purple/pink tones
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.7);
      gradient.addColorStop(0, '#1a0033');
      gradient.addColorStop(0.4, '#2d0050');
      gradient.addColorStop(1, '#0a0020');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Stars/distant lights in sky
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 50; i++) {
        const x = (i * 37 + backgroundRef.current.offset * 0.02) % canvas.width;
        const y = (i * 23) % 200;
        if (Math.floor(frameCountRef.current / 30 + i) % 3 === 0) {
          ctx.fillRect(x, y, 1, 1);
        }
      }

      // Moving grid lines on ground level
      ctx.strokeStyle = 'rgba(255, 0, 255, 0.15)';
      ctx.lineWidth = 1;
      const gridOffset = (backgroundRef.current.offset * 2) % 50;
      for (let i = -50; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i + gridOffset, GROUND_Y);
        ctx.lineTo(i + gridOffset, canvas.height);
        ctx.stroke();
      }

      // Horizontal scanlines
      for (let i = 0; i < canvas.height; i += 4) {
        ctx.fillStyle = 'rgba(0, 255, 255, 0.02)';
        ctx.fillRect(0, i, canvas.width, 1);
      }

      // TALL FUTURISTIC SKYLINE
      // Far background - tallest buildings
      ctx.fillStyle = 'rgba(50, 20, 80, 0.6)';
      
      // Mega skyscrapers in distance
      const megaTowers = [
        { x: 0, width: 60, height: 250 },
        { x: 150, width: 80, height: 280 },
        { x: 350, width: 70, height: 260 },
        { x: 550, width: 90, height: 300 },
        { x: 700, width: 65, height: 270 },
        { x: 850, width: 75, height: 290 }
      ];
      
      // Repeat buildings to create seamless loop - more repeats for longer coverage
      for (let repeat = -2; repeat <= 4; repeat++) {
        megaTowers.forEach(tower => {
          const x = tower.x + repeat * 1000 - (backgroundRef.current.offset % 1000);
          if (x < -150 || x > canvas.width + 50) return;
          
          const y = GROUND_Y - tower.height;
        
        // Tower body
        ctx.fillStyle = 'rgba(40, 10, 60, 0.8)';
        ctx.fillRect(x, y, tower.width, tower.height);
        
        // Subtle window pattern
        const windowSeed = Math.floor(x / 200);
        ctx.fillStyle = 'rgba(0, 200, 255, 0.3)';
        for (let row = 0; row < tower.height; row += 20) {
          for (let col = 0; col < tower.width; col += 15) {
            const windowId = windowSeed * 1000 + row * 10 + col;
            const isLit = (windowId * 2654435761) % 100 > 40;
            if (isLit) {
              ctx.fillRect(x + col + 3, y + row + 3, 8, 3);
            }
          }
        }
        
        // Tower top lights
        ctx.shadowColor = '#ff0066';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ff0066';
        ctx.fillRect(x + tower.width / 2 - 3, y - 10, 6, 10);
        ctx.shadowBlur = 0;
      });
      }
      
      // Mid-layer - medium height buildings
      const midBuildings = [
        { offset: 0, height: 200, width: 110 },
        { offset: 180, height: 220, width: 100 },
        { offset: 360, height: 180, width: 120 },
        { offset: 540, height: 210, width: 95 },
        { offset: 720, height: 190, width: 115 }
      ];
      
      for (let repeat = -2; repeat <= 5; repeat++) {
        midBuildings.forEach(building => {
          const x = building.offset + repeat * 900 - (backgroundRef.current.offset % 900);
          if (x < -150 || x > canvas.width + 50) return;
          
          const buildingHeight = building.height;
          const buildingWidth = building.width;
          const y = GROUND_Y - buildingHeight;
        
        // Building main body
        ctx.fillStyle = 'rgba(20, 5, 40, 0.9)';
        ctx.fillRect(x, y, buildingWidth, buildingHeight);
        
        // Edge lighting
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + buildingHeight);
        ctx.moveTo(x + buildingWidth, y);
        ctx.lineTo(x + buildingWidth, y + buildingHeight);
        ctx.stroke();
        
        // Window grid
        const windowSeed = Math.floor(x / 180); // Consistent seed per building
        for (let row = 10; row < buildingHeight - 10; row += 18) {
          for (let col = 15; col < buildingWidth - 15; col += 22) {
            const windowId = windowSeed * 1000 + row * 100 + col;
            const isLit = (windowId * 2654435761) % 100 > 25; // Deterministic random
            if (isLit) {
              const brightness = ((windowId * 1103515245) % 100) / 100;
              ctx.fillStyle = brightness > 0.7 ? '#00ffff' : brightness > 0.4 ? '#0088ff' : 'rgba(0, 255, 255, 0.3)';
              ctx.fillRect(x + col, y + row, 12, 10);
            }
          }
        }
        
        // Rooftop details
        const buildingId = building.offset + repeat * 900;
        if (buildingId % 360 === 0) {
          // Antenna
          ctx.strokeStyle = '#ff00ff';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#ff00ff';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.moveTo(x + buildingWidth / 2, y);
          ctx.lineTo(x + buildingWidth / 2, y - 30);
          ctx.stroke();
          ctx.shadowBlur = 0;
          
          // Blinking light
          if (Math.floor(frameCountRef.current / 20) % 2 === 0) {
            ctx.fillStyle = '#ff0066';
            ctx.shadowColor = '#ff0066';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(x + buildingWidth / 2, y - 30, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      });
      }
      
      // Foreground - closest buildings
      const closeBuildings = [
        { offset: 0, height: 130 },
        { offset: 150, height: 140 },
        { offset: 300, height: 120 },
        { offset: 450, height: 150 },
        { offset: 600, height: 125 }
      ];
      
      for (let repeat = -2; repeat <= 5; repeat++) {
        closeBuildings.forEach(building => {
          const x = building.offset + repeat * 750 - (backgroundRef.current.offset % 750);
          if (x < -100 || x > canvas.width + 50) return;
          
          const buildingHeight = building.height;
          const buildingWidth = 90;
          const y = GROUND_Y - buildingHeight;
        
        // Building silhouette
        ctx.fillStyle = 'rgba(10, 0, 25, 0.95)';
        ctx.fillRect(x, y, buildingWidth, buildingHeight);
        
        // Bright neon windows
        const windowSeed = Math.floor(x / 150); // Consistent seed per building
        for (let row = 8; row < buildingHeight - 8; row += 15) {
          for (let col = 12; col < buildingWidth - 12; col += 20) {
            const windowId = windowSeed * 1000 + row * 100 + col;
            const isLit = (windowId * 2654435761) % 100 > 30;
            if (isLit) {
              const color = ((windowId * 1103515245) % 100) > 50 ? '#ff00ff' : '#00ffff';
              ctx.fillStyle = color;
              ctx.shadowColor = color;
              ctx.shadowBlur = 8;
              ctx.fillRect(x + col, y + row, 14, 8);
              ctx.shadowBlur = 0;
            }
          }
        }
        
        // Holographic billboard on some buildings
        const buildingId = building.offset + repeat * 750;
        if (buildingId % 300 === 0) {
          ctx.shadowColor = '#ff00ff';
          ctx.shadowBlur = 25;
          ctx.fillStyle = 'rgba(255, 0, 255, 0.8)';
          ctx.fillRect(x + 10, y + 30, 70, 25);
          ctx.shadowBlur = 0;
          
          // Billboard glow effect
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('NEON CORP', x + 45, y + 45);
        }
      });
      }

      // Ground with depth
      const groundGradient = ctx.createLinearGradient(0, GROUND_Y, 0, canvas.height);
      groundGradient.addColorStop(0, '#330066');
      groundGradient.addColorStop(0.5, '#1a0033');
      groundGradient.addColorStop(1, '#0066ff');
      ctx.fillStyle = groundGradient;
      ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
      
      // Ground edge glow
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(canvas.width, GROUND_Y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const drawPlayer = () => {
      const p = playerRef.current;
      
      // Glitch effect
      if (glitchRef.current.active) {
        ctx.save();
        ctx.translate(Math.random() * glitchRef.current.intensity - glitchRef.current.intensity/2, 
                     Math.random() * glitchRef.current.intensity - glitchRef.current.intensity/2);
      }

      // Running animation frame
      const runCycle = Math.floor(frameCountRef.current / 5) % 4;
      
      // Outer glow
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 25;
      
      // Body (torso)
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(p.x + 8, p.y + 10, 14, 18);
      
      // Head with hood
      ctx.fillStyle = '#9900ff';
      ctx.fillRect(p.x + 6, p.y, 18, 12);
      
      // Visor/face (glowing)
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(p.x + 8, p.y + 4, 14, 4);
      
      // Jacket/coat details
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#0066ff';
      ctx.fillRect(p.x + 7, p.y + 12, 6, 16);
      ctx.fillRect(p.x + 17, p.y + 12, 6, 16);
      
      // Arms
      ctx.fillStyle = '#ff00ff';
      // Left arm
      ctx.fillRect(p.x + 4, p.y + 12, 4, 10);
      // Right arm (swinging with run cycle)
      const armSwing = runCycle < 2 ? 0 : 2;
      ctx.fillRect(p.x + 22, p.y + 12 + armSwing, 4, 10);
      
      // Legs (running animation)
      ctx.fillStyle = '#cc00ff';
      if (p.isJumping) {
        // Both legs together when jumping
        ctx.fillRect(p.x + 10, p.y + 28, 4, 12);
        ctx.fillRect(p.x + 16, p.y + 28, 4, 12);
      } else {
        // Alternating leg movement
        const legOffset = runCycle % 2 === 0 ? 0 : 4;
        ctx.fillRect(p.x + 10, p.y + 28 + legOffset, 4, 12);
        ctx.fillRect(p.x + 16, p.y + 28 + (4 - legOffset), 4, 12);
      }
      
      // Cybernetic details (glowing lines)
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 8;
      
      // Lines on torso
      ctx.beginPath();
      ctx.moveTo(p.x + 10, p.y + 15);
      ctx.lineTo(p.x + 20, p.y + 15);
      ctx.moveTo(p.x + 10, p.y + 20);
      ctx.lineTo(p.x + 20, p.y + 20);
      ctx.stroke();
      
      // Backpack/tech pack
      ctx.fillStyle = '#660099';
      ctx.fillRect(p.x + 22, p.y + 14, 6, 10);
      
      // Glowing indicator on pack
      if (Math.floor(frameCountRef.current / 20) % 2 === 0) {
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(p.x + 24, p.y + 16, 2, 2);
      }
      
      // Motion trail effect
      ctx.shadowColor = '#ff00ff';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = 'rgba(255, 0, 255, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 20);
      ctx.lineTo(p.x - 25, p.y + 20);
      ctx.stroke();
      
      // Energy particles trailing behind
      for (let i = 0; i < 3; i++) {
        const trailX = p.x - 10 - i * 8;
        const trailY = p.y + 20 + Math.sin(frameCountRef.current * 0.1 + i) * 3;
        ctx.fillStyle = `rgba(0, 255, 255, ${0.6 - i * 0.2})`;
        ctx.beginPath();
        ctx.arc(trailX, trailY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.shadowBlur = 0;
      
      if (glitchRef.current.active) {
        ctx.restore();
        glitchRef.current.intensity *= 0.9;
        if (glitchRef.current.intensity < 1) glitchRef.current.active = false;
      }
    };

    const drawObstacles = () => {
      obstaclesRef.current.forEach(obs => {
        ctx.shadowColor = '#ff0066';
        ctx.shadowBlur = 20;
        
        if (obs.type === 'spike') {
          // Energy spike - looks like a dangerous laser beam pointing up
          const gradient = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.width / 2, obs.y - obs.height);
          gradient.addColorStop(0, '#ff0066');
          gradient.addColorStop(0.5, '#ff3399');
          gradient.addColorStop(1, '#ff66cc');
          ctx.fillStyle = gradient;
          
          // Main spike triangle
          ctx.beginPath();
          ctx.moveTo(obs.x, obs.y);
          ctx.lineTo(obs.x + obs.width / 2, obs.y - obs.height);
          ctx.lineTo(obs.x + obs.width, obs.y);
          ctx.closePath();
          ctx.fill();
          
          // Energy core line through center
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 25;
          ctx.shadowColor = '#ff0066';
          ctx.beginPath();
          ctx.moveTo(obs.x + obs.width / 2, obs.y);
          ctx.lineTo(obs.x + obs.width / 2, obs.y - obs.height + 5);
          ctx.stroke();
          
          // Pulsing glow at tip
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.arc(obs.x + obs.width / 2, obs.y - obs.height, 3, 0, Math.PI * 2);
          ctx.fill();
          
        } else if (obs.type === 'barrier') {
          // Holographic security barrier
          ctx.fillStyle = 'rgba(255, 0, 102, 0.3)';
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          
          // Vertical energy beams
          for (let i = 0; i < 3; i++) {
            const beamX = obs.x + obs.width / 2;
            
            ctx.strokeStyle = '#ff0066';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff0066';
            ctx.beginPath();
            ctx.moveTo(beamX, obs.y);
            ctx.lineTo(beamX, obs.y + obs.height);
            ctx.stroke();
          }
          
          // Horizontal scan lines (static)
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 1;
          for (let i = 0; i < obs.height; i += 10) {
            ctx.beginPath();
            ctx.moveTo(obs.x, obs.y + i);
            ctx.lineTo(obs.x + obs.width, obs.y + i);
            ctx.stroke();
          }
          
          // Glowing edges
          ctx.strokeStyle = '#ff3399';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 15;
          ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
          
        } else {
          // Energy mine / bomb
          const centerX = obs.x + obs.width / 2;
          const centerY = obs.y + obs.height / 2;
          
          // Outer danger glow
          ctx.fillStyle = 'rgba(255, 0, 102, 0.2)';
          ctx.beginPath();
          ctx.arc(centerX, centerY, obs.width / 2 + 5, 0, Math.PI * 2);
          ctx.fill();
          
          // Main body - hexagonal mine
          ctx.fillStyle = '#cc0055';
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = centerX + Math.cos(angle) * (obs.width / 2.5);
            const y = centerY + Math.sin(angle) * (obs.height / 2.5);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          
          // Danger stripes
          ctx.strokeStyle = '#ffff00';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ffff00';
          for (let i = 0; i < 3; i++) {
            const angle = (Math.PI / 3) * (i * 2);
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
              centerX + Math.cos(angle) * (obs.width / 3),
              centerY + Math.sin(angle) * (obs.height / 3)
            );
            ctx.stroke();
          }
          
          // Pulsing core
          ctx.fillStyle = '#ff0066';
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#ff0066';
          ctx.beginPath();
          ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
          ctx.fill();
          
          // Inner white hot center
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.shadowBlur = 0;
      });
    };

    const drawDrones = () => {
      dronesRef.current.forEach(drone => {
        // Propeller rotation animation
        const rotorSpin = (frameCountRef.current * 0.3 + drone.phase) % (Math.PI * 2);
        
        // Drone body center
        const centerX = drone.x + drone.width / 2;
        const centerY = drone.y + drone.height / 2;
        
        // Outer glow for visibility
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 30;
        ctx.fillStyle = 'rgba(255, 0, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, 28, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Main body (sleek design) - brighter
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#6600cc';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, 20, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Body panel lines - brighter
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - 15, centerY);
        ctx.lineTo(centerX + 15, centerY);
        ctx.stroke();
        
        // Camera/sensor eye - larger and brighter
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 7, 0, Math.PI * 2);
        ctx.fill();
        
        // Camera lens reflection
        ctx.fillStyle = '#ffaaaa';
        ctx.beginPath();
        ctx.arc(centerX - 2, centerY - 2, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        
        // Four propeller arms - brighter and thicker
        const armLength = 18;
        const armPositions = [
          { angle: 0, x: armLength, y: 0 },
          { angle: Math.PI / 2, x: 0, y: armLength },
          { angle: Math.PI, x: -armLength, y: 0 },
          { angle: Math.PI * 1.5, x: 0, y: -armLength }
        ];
        
        armPositions.forEach(arm => {
          // Arm strut - brighter
          ctx.strokeStyle = '#9933ff';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#9933ff';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(centerX + arm.x, centerY + arm.y);
          ctx.stroke();
          ctx.shadowBlur = 0;
          
          // Motor housing at end of arm - brighter
          ctx.fillStyle = '#7700cc';
          ctx.shadowColor = '#ff00ff';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(centerX + arm.x, centerY + arm.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          
          // Spinning propeller blades - brighter and thicker
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#00ffff';
          ctx.shadowBlur = 15;
          
          // Two blades per propeller
          for (let b = 0; b < 2; b++) {
            const bladeAngle = rotorSpin + (b * Math.PI);
            const bladeLen = 10;
            
            ctx.beginPath();
            ctx.moveTo(
              centerX + arm.x - Math.cos(bladeAngle) * bladeLen,
              centerY + arm.y - Math.sin(bladeAngle) * bladeLen
            );
            ctx.lineTo(
              centerX + arm.x + Math.cos(bladeAngle) * bladeLen,
              centerY + arm.y + Math.sin(bladeAngle) * bladeLen
            );
            ctx.stroke();
          }
          
          ctx.shadowBlur = 0;
          
          // Propeller glow effect when spinning - brighter
          ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
          ctx.beginPath();
          ctx.arc(centerX + arm.x, centerY + arm.y, 10, 0, Math.PI * 2);
          ctx.fill();
        });
        
        // Bottom lights (navigation/status) - brighter
        const lightBlink = Math.floor(frameCountRef.current / 15) % 2 === 0;
        if (lightBlink) {
          ctx.fillStyle = '#00ff00';
          ctx.shadowColor = '#00ff00';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(centerX - 12, centerY + 10, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(centerX + 12, centerY + 10, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        
        drone.phase += 0.1;
      });
    };

    const drawNodes = () => {
      nodesRef.current.forEach(node => {
        const pulse = Math.sin(node.pulse) * 5;
        
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 20 + pulse;
        ctx.fillStyle = '#00ff00';
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size + pulse, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(node.x, node.y, (node.size + pulse) / 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        node.pulse += 0.15;
      });
    };

    const drawUI = () => {
      // Level indicator
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`LEVEL ${level}`, 20, 30);
      
      // Data packets collected
      drawNeonText(`DATA PACKETS: ${coinsCollected}`, canvas.width / 2, 40, 24, '#00ff00', 15);
      
      // Score progress bar
      const barWidth = 300;
      const barHeight = 20;
      const barX = (canvas.width - barWidth) / 2;
      const barY = 60;
      const maxScore = 500; // Score needed to complete level
      const progress = Math.min(score / maxScore, 1);
      
      // Bar background
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
      
      // Bar fill
      const fillGradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
      fillGradient.addColorStop(0, '#ff00ff');
      fillGradient.addColorStop(0.5, '#00ffff');
      fillGradient.addColorStop(1, '#00ff00');
      ctx.fillStyle = fillGradient;
      ctx.fillRect(barX, barY, barWidth * progress, barHeight);
      
      // Bar label
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`TRANSMISSION STRENGTH: ${Math.floor(progress * 100)}%`, canvas.width / 2, barY + barHeight + 15);
    };

    const checkCollision = (rect1, rect2) => {
      return rect1.x < rect2.x + rect2.width &&
             rect1.x + rect1.width > rect2.x &&
             rect1.y < rect2.y + rect2.height &&
             rect1.y + rect1.height > rect2.y;
    };

    const gameLoop = () => {
      if (gameState !== 'playing') return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      drawBackground();
      
      // Update background
      backgroundRef.current.offset += GAME_SPEED;
      
      // Update player
      const player = playerRef.current;
      player.velocityY += GRAVITY;
      player.y += player.velocityY;
      
      if (player.y >= GROUND_Y) {
        player.y = GROUND_Y;
        player.velocityY = 0;
        player.isJumping = false;
      }
      
      drawPlayer();
      
      // Spawn entities (more frequent on higher levels)
      frameCountRef.current++;
      const obstacleFrequency = Math.max(60, 90 - (level - 1) * 15);
      const droneFrequency = Math.max(100, 150 - (level - 1) * 25);
      const nodeFrequency = 70;
      
      if (frameCountRef.current % obstacleFrequency === 0) spawnObstacle();
      if (frameCountRef.current % droneFrequency === 0) spawnDrone();
      if (frameCountRef.current % nodeFrequency === 0) spawnNode();
      
      // Update and draw obstacles
      obstaclesRef.current = obstaclesRef.current.filter(obs => {
        obs.x -= GAME_SPEED;
        return obs.x > -obs.width;
      });
      drawObstacles();
      
      // Update and draw drones
      dronesRef.current = dronesRef.current.filter(drone => {
        drone.x -= GAME_SPEED;
        return drone.x > -drone.width;
      });
      drawDrones();
      
      // Update and draw nodes
      nodesRef.current = nodesRef.current.filter(node => {
        node.x -= GAME_SPEED;
        return node.x > -node.size;
      });
      drawNodes();
      
      // Check collisions with obstacles
      for (const obs of obstaclesRef.current) {
        if (checkCollision(player, obs)) {
          gameOver();
          return;
        }
      }
      
      // Check collisions with drones
      for (const drone of dronesRef.current) {
        if (checkCollision(player, drone)) {
          gameOver();
          return;
        }
      }
      
      // Check collisions with nodes
      nodesRef.current = nodesRef.current.filter(node => {
        const nodeRect = { x: node.x - node.size, y: node.y - node.size, width: node.size * 2, height: node.size * 2 };
        if (checkCollision(player, nodeRect)) {
          setScore(s => s + 10);
          setCoinsCollected(c => c + 1);
          playSound('collect');
          glitchRef.current = { active: true, intensity: 5 };
          return false;
        }
        return true;
      });
      
      // Check if level complete
      if (score >= 500) {
        levelComplete();
        return;
      }
      
      // Increase score over time
      if (frameCountRef.current % 10 === 0) {
        setScore(s => s + 1);
      }
      
      drawUI();
      
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    const handleKeyDown = (e) => {
      if (gameState === 'playing' && (e.code === 'Space' || e.code === 'ArrowUp') && !playerRef.current.isJumping) {
        playerRef.current.velocityY = JUMP_FORCE;
        playerRef.current.isJumping = true;
        playSound('jump');
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if (gameState === 'playing') {
      gameLoop();
    } else if (gameState === 'menu') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground();
      drawNeonText('NEON COURIER', canvas.width / 2, 150, 48, '#ff00ff', 30);
      drawNeonText('ROGUE SIGNAL', canvas.width / 2, 200, 32, '#00ffff', 20);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('The megacorps are hiding something...', canvas.width / 2, 260);
      ctx.fillText('Collect data packets and reach 100% transmission.', canvas.width / 2, 280);
      
      drawNeonText('PRESS SPACE TO START', canvas.width / 2, 350, 20, '#00ff00', 15);
      
      if (highScore > 0) {
        ctx.fillStyle = '#ff00ff';
        ctx.font = '16px monospace';
        ctx.fillText(`HIGH SCORE: ${highScore}`, canvas.width / 2, 400);
      }
    } else if (gameState === 'levelComplete') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground();
      
      drawNeonText(`LEVEL ${level} COMPLETE`, canvas.width / 2, 150, 40, '#00ff00', 25);
      drawNeonText(`SCORE: ${score}`, canvas.width / 2, 220, 28, '#00ffff', 20);
      
      ctx.fillStyle = '#00ff00';
      ctx.font = '18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${coinsCollected} DATA PACKETS SECURED`, canvas.width / 2, 270);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      if (level === 1) {
        ctx.fillText('You\'ve cracked the first layer of encryption!', canvas.width / 2, 310);
        ctx.fillText('But the conspiracy goes deeper...', canvas.width / 2, 330);
      } else {
        ctx.fillText('You\'ve exposed the conspiracy!', canvas.width / 2, 310);
        ctx.fillText('The truth is finally revealed...', canvas.width / 2, 330);
      }
      
      if (score > highScore) {
        drawNeonText('NEW HIGH SCORE!', canvas.width / 2, 370, 24, '#ffff00', 20);
      }
    } else if (gameState === 'gameOver') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground();
      
      drawNeonText('CONNECTION LOST', canvas.width / 2, 150, 40, '#ff0066', 25);
      drawNeonText(`LEVEL ${level} - SCORE: ${score}`, canvas.width / 2, 220, 28, '#00ffff', 20);
      
      ctx.fillStyle = '#00ff00';
      ctx.font = '18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${coinsCollected} DATA PACKETS RECOVERED`, canvas.width / 2, 270);
      
      const progress = Math.floor((score / 500) * 100);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText(`Transmission was ${progress}% complete`, canvas.width / 2, 300);
      
      if (coinsCollected < 5) {
        ctx.fillText('The conspiracy runs deeper than you thought...', canvas.width / 2, 330);
      } else if (coinsCollected < 15) {
        ctx.fillText('You\'re getting closer to the truth.', canvas.width / 2, 330);
      } else {
        ctx.fillText('The megacorps won\'t let you expose them easily.', canvas.width / 2, 330);
      }
      
      if (score > highScore) {
        drawNeonText('NEW HIGH SCORE!', canvas.width / 2, 370, 24, '#ffff00', 20);
      }
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      stopMusic();
    };
  }, [gameState, score, highScore, soundEnabled]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-purple-900 via-black to-blue-900 p-4">
      <div className="relative">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={400}
          className="border-4 border-cyan-400 rounded-lg shadow-2xl shadow-cyan-500/50"
          style={{ imageRendering: 'pixelated' }}
        />
        
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded shadow-lg shadow-purple-500/50 transition-all"
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>
      </div>
      
      <div className="mt-6 flex gap-4">
        {gameState === 'menu' && (
          <button
            onClick={startGame}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white px-8 py-3 rounded-lg font-bold text-lg shadow-lg shadow-cyan-500/50 transition-all transform hover:scale-105"
          >
            <Play size={24} />
            START TRANSMISSION
          </button>
        )}
        
        {gameState === 'levelComplete' && (
          <>
            {level < 2 && (
              <button
                onClick={nextLevel}
                className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-400 hover:to-cyan-400 text-white px-8 py-3 rounded-lg font-bold text-lg shadow-lg shadow-green-500/50 transition-all transform hover:scale-105"
              >
                <Play size={24} />
                NEXT LEVEL
              </button>
            )}
            <button
              onClick={restartGame}
              className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white px-8 py-3 rounded-lg font-bold text-lg shadow-lg shadow-pink-500/50 transition-all transform hover:scale-105"
            >
              <RotateCcw size={24} />
              RESTART
            </button>
          </>
        )}
        
        {gameState === 'gameOver' && (
          <button
            onClick={restartGame}
            className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white px-8 py-3 rounded-lg font-bold text-lg shadow-lg shadow-pink-500/50 transition-all transform hover:scale-105"
          >
            <RotateCcw size={24} />
            RECONNECT
          </button>
        )}
      </div>
      
      <div className="mt-4 text-center text-cyan-300 font-mono text-sm">
        <p>PRESS SPACE or ↑ to JUMP</p>
        <p className="text-pink-300 mt-2">Collect data packets • Reach 100% transmission • Expose the truth</p>
      </div>
    </div>
  );
};

export default NeonRunner;