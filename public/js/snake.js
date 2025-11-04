// snake.js - Optimized client-side rendering helper for snakes

const SnakeRenderer = {
  headImage: null,
  bodyImages: [],
  Nball: 13,

  // Offscreen caches: Map<key, HTMLCanvasElement>
  scaledBodyCache: new Map(), // key: `${index}|${size}`
  scaledHeadCache: new Map(), // key: `${size}|${angleQuant}` (if quantized)
  assetsLoaded: false,
  loadedFlags: { head: false, bodies: 0 },

  loadAssets: function () {
    // Head
    this.headImage = new Image();
    this.headImage.src = "images/head.png";
    this.headImage.onload = () => {
      this.loadedFlags.head = true;
      this._checkAllLoaded();
    };

    // Bodies
    for (let i = 0; i < this.Nball; i++) {
      const img = new Image();
      img.src = `images/body/${i}.png`;
      img.onload = () => {
        this.loadedFlags.bodies++;
        this._checkAllLoaded();
      };
      this.bodyImages.push(img);
    }
  },

  _checkAllLoaded: function () {
    if (this.loadedFlags.head && this.loadedFlags.bodies >= this.Nball) {
      this.assetsLoaded = true;
    }
  },

  // Return an offscreen canvas with image scaled to (size x size).
  _getScaledImageCanvas: function (img, size, cacheKeyPrefix = "body") {
    if (!img) return null;
    const key = `${cacheKeyPrefix}|${img.src}|${Math.round(size)}`;
    const cache = cacheKeyPrefix === "body" ? this.scaledBodyCache : this.scaledHeadCache;
    if (cache.has(key)) return cache.get(key);

    // create offscreen canvas
    const cvs = document.createElement("canvas");
    const s = Math.max(1, Math.round(size));
    cvs.width = s;
    cvs.height = s;
    const cctx = cvs.getContext("2d");
    // draw scaled with integer dims to reduce subpixel overhead
    cctx.drawImage(img, 0, 0, s, s);
    cache.set(key, cvs);
    return cvs;
  },

  // Optional: quantize angle to reduce different rotations for head caching.
  _quantizeAngle: function (angle, steps = 36) {
    return Math.round((angle / (2 * Math.PI)) * steps) / steps;
  },

  draw: function (ctx, snakeData, camera, gameSettings) {
    if (!snakeData || !snakeData.segments || snakeData.segments.length === 0) return;

    // Local caches for frame
    const canvasW = ctx.canvas.width;
    const canvasH = ctx.canvas.height;
    const base = gameSettings.SNAKE_BASE_SIZE * snakeData.sizeMultiplier;
    const half = base / 2;
    const bodyIndex = snakeData.bodyImageIndex % this.Nball;
    const bodyImg = this.bodyImages[bodyIndex];
    const bodyCanvas = bodyImg && bodyImg.complete ? this._getScaledImageCanvas(bodyImg, base, "body") : null;

    // Pre-set text styles once per draw call (avoid repeated set on each segment)
    ctx.textAlign = "center";
    ctx.font = "12px Arial";
    ctx.fillStyle = "white";

    // Pre-calc culling rect (expanded by half to account for radius)
    const minX = -half;
    const minY = -half;
    const maxX = canvasW + half;
    const maxY = canvasH + half;

    // Draw body segments (from tail to 1) - local variables to reduce lookup
    const segs = snakeData.segments;
    for (let i = segs.length - 1; i >= 1; i--) {
      const s = segs[i];
      const sx = s.x - camera.x;
      const sy = s.y - camera.y;

      // Fast culling
      if (sx < minX || sx > maxX || sy < minY || sy > maxY) continue;

      if (bodyCanvas) {
        // Use integer positions for drawImage to improve rendering speed
        ctx.drawImage(bodyCanvas, Math.round(sx - half), Math.round(sy - half));
      } else {
        // fallback simple circle
        ctx.beginPath();
        ctx.arc(sx, sy, half, 0, Math.PI * 2);
        ctx.fillStyle = snakeData.color;
        ctx.fill();
      }
    }

    // Draw head (index 0)
    const head = segs[0];
    const hx = head.x - camera.x;
    const hy = head.y - camera.y;
    if (!(hx < minX || hx > maxX || hy < minY || hy > maxY)) {
      // If we want caching for rotated heads, quantize angle
      const angle = snakeData.angle + Math.PI / 2; // original offset
      // Example quantization: 36 steps (~10deg). Toggle quantization by setting steps to Infinity to disable.
      const angleQuant = this._quantizeAngle(angle, 36);
      // For head, create rotated cache keyed by size+angleQuant
      let headCanvas = null;
      if (this.headImage && this.headImage.complete) {
        const cacheKey = `head|${Math.round(base)}|${angleQuant}`;
        if (this.scaledHeadCache.has(cacheKey)) {
          headCanvas = this.scaledHeadCache.get(cacheKey);
        } else {
          // create rotated offscreen canvas
          const cvs = document.createElement("canvas");
          const s = Math.max(1, Math.round(base));
          cvs.width = s;
          cvs.height = s;
          const cctx = cvs.getContext("2d");
          cctx.translate(s / 2, s / 2);
          cctx.rotate(angleQuant * 2 * Math.PI); // convert back to radians
          cctx.drawImage(this._getScaledImageCanvas(this.headImage, base, "head"), -s / 2, -s / 2);
          this.scaledHeadCache.set(cacheKey, cvs);
          headCanvas = cvs;
        }
        ctx.drawImage(headCanvas, Math.round(hx - half), Math.round(hy - half));
      } else {
        // fallback circle for head
        ctx.beginPath();
        ctx.arc(hx, hy, half, 0, Math.PI * 2);
        ctx.fillStyle = snakeData.color;
        ctx.fill();
      }
    }

    // Draw name (above head)
    ctx.fillStyle = "white"; // set once (already set above but ensure)
    ctx.fillText(snakeData.name, Math.round(hx), Math.round(hy - half - 5));
  },
};

SnakeRenderer.loadAssets();
