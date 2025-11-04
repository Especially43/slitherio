Nball = 11;
class snake {
    constructor(name, game, score, x, y) {
        this.name = name;
        this.game = game;
        this.score = score;
        this.x = x;
        this.y = y;
        this.init();
    }

    init() {
        const { getSize } = this.game;
    
        this.time = Math.floor(20 + Math.random() * 100);
        this.speed = 1;
        this.size = getSize();
    
        this.angle = 0;
    
        const randSpeed = () => (Math.random() - 0.5) * 2 * MaxSpeed;
        this.dx = randSpeed();
        this.dy = randSpeed();
    
        this.v = Array.from({ length: 50 }, () => ({ x: this.x, y: this.y }));
    
        this.sn_im = new Image();
        this.sn_im.src = "images/head.png";
    
        // === ОНОВЛЕНЕ: Яскраві кольори з canvas-градієнтом ===
    
        // 1. Генеруємо яскравий основний колір змії
        const hue = Math.floor(Math.random() * 360);
        const baseColor = `hsl(${hue}, 100%, 55%)`;  // яскравіший, ніж було (60% → 55%)
    
        // 2. Створюємо оффскрін canvas
        const segmentSize = Math.max(Math.floor(this.size), 1);
        const offscreen = document.createElement("canvas");
        offscreen.width = segmentSize;
        offscreen.height = segmentSize;
        const offCtx = offscreen.getContext("2d");
    
        // 3. Центр і радіус круга
        const cx = segmentSize / 2;
        const cy = segmentSize / 2;
        const radius = segmentSize / 2.2;
    
        // 4. Радіальний градієнт (внутрішній блиск і насичені кольори)
        const gradient = offCtx.createRadialGradient(cx, cy, radius / 6, cx, cy, radius);
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.25, baseColor);
        gradient.addColorStop(1, `hsl(${hue}, 100%, 25%)`); // темний відтінок того ж кольору
    
        // 5. Малювання круга з тінню
        offCtx.save();
        offCtx.shadowColor = "rgba(0, 0, 0, 0.4)";
        offCtx.shadowBlur = 8;
        offCtx.fillStyle = gradient;
        offCtx.beginPath();
        offCtx.arc(cx, cy, radius, 0, 2 * Math.PI);
        offCtx.fill();
        offCtx.restore();
    
        // 6. Зберігаємо текстуру
        this.bd_im = offscreen;
    }
    
    
    
    

    update() {
        this.time--;
        this.angle = this.getAngle(this.dx, this.dy);
        if (this.name != "Slitherio") {
            if (this.time > 90)
                this.speed = 2;
            else
                this.speed = 1;
            if (this.time <= 0) {
                this.time = Math.floor(10 + Math.random() * 20);
                this.dx = Math.random() * MaxSpeed - Math.random() * MaxSpeed;
                this.dy = Math.random() * MaxSpeed - Math.random() * MaxSpeed;

                let minRange = Math.sqrt(game_W * game_W + game_H * game_H);

                for (let i = 0; i < FOOD.length; i++) {
                    if (FOOD[i].size > this.game.getSize() / 10 && this.range(this.v[0], FOOD[i]) < minRange) {
                        minRange = this.range(this.v[0], FOOD[i]);
                        this.dx = FOOD[i].x - this.v[0].x;
                        this.dy = FOOD[i].y - this.v[0].y;
                    }
                }
                if (minRange < Math.sqrt(game_W * game_W + game_H * game_H))
                    this.time = 0;
                // console.log(minRange);

                while (Math.abs(this.dy) * Math.abs(this.dy) + Math.abs(this.dx) * Math.abs(this.dx) > MaxSpeed * MaxSpeed && this.dx * this.dy != 0) {
                    this.dx /= 1.1;
                    this.dy /= 1.1;
                }
                while (Math.abs(this.dy) * Math.abs(this.dy) + Math.abs(this.dx) * Math.abs(this.dx) < MaxSpeed * MaxSpeed && this.dx * this.dy != 0) {
                    this.dx *= 1.1;
                    this.dy *= 1.1;
                }
            }
            this.score += this.score / 666;
        }

        this.v[0].x += this.dx * this.speed;
        this.v[0].y += this.dy * this.speed;

        for (let i = 1; i < this.v.length; i++) {
            if (this.range(this.v[i], this.v[i - 1]) > this.size / 5) {
                this.v[i].x = (this.v[i].x + this.v[i - 1].x) / 2;
                this.v[i].y = (this.v[i].y + this.v[i - 1].y) / 2;
                this.v[i].x = (this.v[i].x + this.v[i - 1].x) / 2;
                this.v[i].y = (this.v[i].y + this.v[i - 1].y) / 2;
            }
        }
        if (this.score < 200)
            return;
        if (this.speed == 2)
            this.score -= this.score / 2000;;
        let csUp = Math.pow((this.score) / 1000, 1 / 5);
        this.size = this.game.getSize() / 2 * csUp;
        let N = 3 * Math.floor(50 * Math.pow((this.score) / 1000, 1 / 1));
        if (N > this.v.length) {
            this.v[this.v.length] = { x: this.v[this.v.length - 1].x, y: this.v[this.v.length - 1].y };
        } else
            this.v = this.v.slice(0, N);
    }

    draw() {
        this.update();

        for (let i = this.v.length - 1; i >= 1; i--)
            if (this.game.isPoint(this.v[i].x, this.v[i].y))
                this.game.context.drawImage(this.bd_im, this.v[i].x - XX - (this.size) / 2, this.v[i].y - YY - (this.size) / 2, this.size, this.size);

        this.game.context.save();
        this.game.context.translate(this.v[0].x - XX, this.v[0].y - YY);
        this.game.context.rotate(this.angle - Math.PI / 2);
        this.game.context.drawImage(this.sn_im, -this.size / 2, -this.size / 2, this.size, this.size);
        this.game.context.restore();
  //name
this.game.context.save();
const fontSize = Math.min(this.size / 2, 28);
this.game.context.font = `${Math.floor(fontSize)}px Arial`;

this.game.context.fillStyle = "white"; 
this.game.context.textAlign = "center";
this.game.context.fillText(this.name, this.v[0].x - XX, this.v[0].y - YY - this.size);
this.game.context.restore();

    }

    getAngle(a, b) {
        let c = Math.sqrt(a * a + b * b);
        let al = Math.acos(a / c);
        if (b < 0)
            al += 2 * (Math.PI - al);
        return al;
    }

    range(v1, v2) {
        return Math.sqrt((v1.x - v2.x) * (v1.x - v2.x) + (v1.y - v2.y) * (v1.y - v2.y));
    }
}
