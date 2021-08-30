const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const SCORE_SIZE = 60;
const W = 640;
const H = 640 + SCORE_SIZE;

const GEM_W = 80;
const GEM_H = 80;
const GEM_GAP = 10;
const STROKE_GAP = 5;

const BG_COLOR = "#1115";
const BG_COLOR_2 = "#1117";

canvas.width = W;
canvas.height = H;

const gems = new Array(8);

let paused = false;
let lastUpdate = 0;

// const COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "white"];
const COLORS = [
  "#d70d0b",
  "#ff7814",
  "#eaea3d",
  "#1cc81c",
  "#156edb",
  "#d11cce",
  "#ddd",
];

const STATES = {};
STATES[(STATES["USER"] = 1)] = "USER";
STATES[(STATES["SWAP"] = 2)] = "SWAP";
STATES[(STATES["CHECK"] = 3)] = "CHECK";
STATES[(STATES["REVERT"] = 4)] = "REVERT";
STATES[(STATES["REMOVE"] = 5)] = "REMOVE";
STATES[(STATES["FALL"] = 6)] = "FALL";
STATES[(STATES["ADD"] = 7)] = "ADD";
STATES[(STATES["GAME_OVER"] = 8)] = "GAME_OVER";

let currentState = STATES.GAME_OVER;
let nextState = currentState;
let stateChangeDelay = 0;

let mousePos = null;
let mouseClicked = false;
let mousePressed = false;
const keyPressed = {};

let selectedGem = null;
let swapGem = null;
let totalGems = 0;
let score = 0;
let maxBurned = 0;

function tick() {
  const dt = Date.now() - lastUpdate;
  lastUpdate = Date.now();

  if (!paused) {
    update(dt);
  }

  render();

  window.requestAnimationFrame(tick);
}

function update(dt) {
  if (stateChangeDelay > 0) {
    stateChangeDelay -= dt;
  } else {
    if (currentState !== nextState) {
      // console.log("transition", STATES[currentState], "=>", STATES[nextState]);
      currentState = nextState;
    }

    switch (currentState) {
      case STATES.USER:
        if (selectedGem && mouseClicked) {
          const diff = Math.abs(
            mousePos.x - selectedGem.x + (mousePos.y - selectedGem.y)
          );
          if (diff === 1) {
            swapGem = { ...mousePos };
            nextState = STATES.SWAP;
          } else {
            selectedGem = { ...mousePos };
          }
        } else if (!selectedGem && mouseClicked) {
          selectedGem = { ...mousePos };
        } else if (selectedGem && mousePos && mousePressed) {
          const diff = Math.abs(
            mousePos.x - selectedGem.x + (mousePos.y - selectedGem.y)
          );
          if (diff === 1) {
            swapGem = { ...mousePos };
            nextState = STATES.SWAP;
          }
        }

        break;

      case STATES.SWAP:
        {
          let tmp = gems[selectedGem.y][selectedGem.x];
          gems[selectedGem.y][selectedGem.x] = gems[swapGem.y][swapGem.x];
          gems[swapGem.y][swapGem.x] = tmp;
        }

        stateChangeDelay = 200;
        nextState = STATES.CHECK;
        break;

      case STATES.CHECK:
        let hasMatches = false;

        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            {
              let l = 1;
              let xx = x + 1;
              while (
                xx < 8 &&
                !gems[y][xx].scoredH &&
                gems[y][xx].color === gems[y][x].color
              ) {
                l++;
                xx++;
              }
              if (l >= 3) {
                hasMatches = true;

                while (l > 0) {
                  l--;
                  score += l;
                  gems[y][x + l].remove = true;
                  gems[y][x + l].scoredH = true;
                }
              }
            }
            {
              let l = 1;
              let yy = y + 1;
              while (
                yy < 8 &&
                !gems[yy][x].scoredV &&
                gems[yy][x].color === gems[y][x].color
              ) {
                l++;
                yy++;
              }
              if (l >= 3) {
                hasMatches = true;
                while (l > 0) {
                  l--;
                  score += l;
                  gems[y + l][x].remove = true;
                  gems[y + l][x].scoredV = true;
                }
              }
            }
          }
        }

        stateChangeDelay = 100;
        if (hasMatches) {
          nextState = STATES.REMOVE;

          swapGem = null;
          selectedGem = null;
          stateChangeDelay = 300;
        } else if (swapGem) {
          nextState = STATES.REVERT;
        } else {
          if (isSolvable(gems)) {
            nextState = STATES.USER;
          } else {
            nextState = STATES.GAME_OVER;
          }
        }

        break;

      case STATES.REVERT:
        {
          let tmp = gems[selectedGem.y][selectedGem.x];
          gems[selectedGem.y][selectedGem.x] = gems[swapGem.y][swapGem.x];
          gems[swapGem.y][swapGem.x] = tmp;
        }

        swapGem = null;
        selectedGem = null;

        stateChangeDelay = 200;
        nextState = STATES.USER;
        break;

      case STATES.REMOVE:
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            if (gems[y][x].remove) {
              gems[y][x].alive = false;
              totalGems--;
            }
          }
        }
        stateChangeDelay = 200;
        nextState = STATES.FALL;
        break;

      case STATES.FALL:
        for (let x = 0; x < 8; x++) {
          for (let y = 6; y >= 0; y--) {
            if (gems[y][x].alive && !gems[y + 1][x].alive) {
              {
                let tmp = gems[y][x];
                gems[y][x] = gems[y + 1][x];
                gems[y + 1][x] = tmp;
              }
            }
          }
        }

        stateChangeDelay = 50;
        nextState = STATES.ADD;
        break;

      case STATES.ADD:
        for (let x = 0; x < 8; x++) {
          if (!gems[0][x].alive) {
            totalGems++;
            gems[0][x].alive = true;
            gems[0][x].remove = false;
            gems[0][x].scoredH = false;
            gems[0][x].scoredV = false;
            gems[0][x].color =
              COLORS[Math.floor(Math.random() * COLORS.length)];
          }
        }

        if (totalGems < 64) {
          nextState = STATES.FALL;
        } else {
          nextState = STATES.CHECK;
        }
        stateChangeDelay = 100;
        break;

      case STATES.GAME_OVER:
        if (keyPressed["Space"]) {
          for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
              gems[y][x].alive = false;
            }
          }

          score = 0;
          totalGems = 0;

          nextState = STATES.ADD;
        }
        break;

      default:
        break;
    }
  }

  mouseClicked = false;
}

function render() {
  ctx.clearRect(0, 0, W, H);

  if (currentState === STATES.USER && selectedGem) {
    ctx.fillStyle = "#fffb";
    ctx.fillRect(selectedGem.x * GEM_W, selectedGem.y * GEM_H, GEM_W, GEM_H);
    // ctx.fillStyle = BG_COLOR;
    // ctx.fillRect(
    //   selectedGem.x * GEM_W + STROKE_GAP,
    //   selectedGem.y * GEM_H + STROKE_GAP,
    //   GEM_W - STROKE_GAP * 2,
    //   GEM_H - STROKE_GAP * 2
    // );
  } else if (currentState === STATES.USER && mousePos) {
    ctx.fillStyle = "#fff5";
    ctx.fillRect(mousePos.x * GEM_W, mousePos.y * GEM_H, GEM_W, GEM_H);
    // ctx.fillStyle = BG_COLOR;
    // ctx.fillRect(
    //   mousePos.x * GEM_W + STROKE_GAP,
    //   mousePos.y * GEM_H + STROKE_GAP,
    //   GEM_W - STROKE_GAP * 2,
    //   GEM_H - STROKE_GAP * 2
    // );
  }

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if ((x + y) % 2) {
        ctx.fillStyle = BG_COLOR;
      } else {
        ctx.fillStyle = BG_COLOR_2;
      }
      ctx.fillRect(x * GEM_W, y * GEM_H, GEM_W, GEM_H);

      if (!gems[y][x].alive) continue;

      ctx.fillStyle = gems[y][x].color;

      if (gems[y][x].remove) {
        // ctx.fillRect(x * GEM_W, y * GEM_H, GEM_W, GEM_H);
        ctx.fillRect(
          x * GEM_W + GEM_GAP,
          y * GEM_H + GEM_GAP,
          GEM_W - GEM_GAP * 2,
          GEM_H - GEM_GAP * 2
        );
      } else {
        drawShape(gems[y][x], x, y);
      }
    }
  }

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, H - SCORE_SIZE, W, SCORE_SIZE);

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  if (currentState === STATES.GAME_OVER) {
    ctx.fillStyle = BG_COLOR_2;
    ctx.fillRect(0, 0, W, H - SCORE_SIZE);

    ctx.fillStyle = "#fff";
    ctx.font = "60px monospace";
    ctx.fillText(`No more moves`, W / 2, H * 0.4, W * 0.8);

    ctx.font = "32px monospace";
    ctx.fillText(`[Space] - restart`, W / 2, H * 0.4 + 60, W * 0.8);
  }

  ctx.font = "32px monospace";
  ctx.fillText(`score: ${score}`, W / 2, H, W * 0.8);
}

function initialize() {
  for (let y = 0; y < 8; y++) {
    gems[y] = new Array(8);
    for (let x = 0; x < 8; x++) {
      gems[y][x] = {
        alive: false,
        remove: false,
        scoredH: false,
        scoredV: false,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    }
  }

  lastUpdate = Date.now();
  window.requestAnimationFrame(tick);
}

function isSolvable(grid) {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const c = grid[y][x].color;

      // checking .xx. horizontally
      if (matches(grid, x + 1, y, c)) {
        if (matches(grid, x - 2, y, c)) return true;
        if (matches(grid, x - 1, y - 1, c)) return true;
        if (matches(grid, x - 1, y + 1, c)) return true;
        if (matches(grid, x + 3, y, c)) return true;
        if (matches(grid, x + 2, y - 1, c)) return true;
        if (matches(grid, x + 2, y + 1, c)) return true;
      }

      // checking x.x horizontally
      if (matches(grid, x + 2, y, c)) {
        if (matches(grid, x + 1, y - 1, c)) return true;
        if (matches(grid, x + 1, y + 1, c)) return true;
      }

      // checking .xx. vertically
      if (matches(grid, x, y + 1, c)) {
        if (matches(grid, x, y - 2, c)) return true;
        if (matches(grid, x - 1, y - 1, c)) return true;
        if (matches(grid, x + 1, y - 1, c)) return true;
        if (matches(grid, x, y + 3, c)) return true;
        if (matches(grid, x - 1, y + 2, c)) return true;
        if (matches(grid, x + 1, y + 2, c)) return true;
      }

      // checking x.x vertically
      if (matches(grid, x, y + 2, c)) {
        if (matches(grid, x - 1, y + 1, c)) return true;
        if (matches(grid, x + 1, y + 1, c)) return true;
      }
    }
  }

  return false;
}

function matches(grid, x, y, color) {
  if (x < 0 || y < 0 || x > 7 || y > 7) {
    return false;
  }

  return grid[y][x].color === color;
}

function drawShape(shape, x, y) {
  const originX = x * GEM_W;
  const originY = y * GEM_H;

  switch (shape.color) {
    // red
    case COLORS[0]: {
      const gapH = 15;
      const gapV = 15;
      ctx.fillRect(
        originX + gapH,
        originY + gapV,
        GEM_W - gapH * 2,
        GEM_H - gapV * 2
      );
      break;
    }

    // orange
    case COLORS[1]:
      {
        const gapH = 13;
        const gapV = 10;
        const y1 = 0.3;
        const y2 = 0.7;

        ctx.beginPath();
        ctx.moveTo(originX + GEM_W / 2, originY + gapV);
        ctx.lineTo(originX + GEM_W - gapH, originY + GEM_H * y1);
        ctx.lineTo(originX + GEM_W - gapH, originY + GEM_H * y2);
        ctx.lineTo(originX + GEM_W / 2, originY + GEM_H - gapV);
        ctx.lineTo(originX + gapH, originY + GEM_H * y2);
        ctx.lineTo(originX + gapH, originY + GEM_H * y1);
        ctx.closePath();
        ctx.fill();
      }
      break;

    // yellow
    case COLORS[2]:
      {
        const gapH = 8;
        const gapV = 8;

        ctx.beginPath();
        ctx.moveTo(originX + GEM_W / 2, originY + gapV);
        ctx.lineTo(originX + GEM_W - gapH, originY + GEM_H * 0.5);
        ctx.lineTo(originX + GEM_W / 2, originY + GEM_H - gapV);
        ctx.lineTo(originX + gapH, originY + GEM_H * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      break;

    // green
    case COLORS[3]:
      {
        const gapH = 12;
        const gapV = 12;
        const p1 = 0.3;
        const p2 = 0.7;

        ctx.beginPath();
        ctx.moveTo(originX + GEM_W * p1, originY + gapV);
        ctx.lineTo(originX + GEM_W * p2, originY + gapV);
        ctx.lineTo(originX + GEM_W - gapH, originY + GEM_H * p1);
        ctx.lineTo(originX + GEM_W - gapH, originY + GEM_H * p2);

        ctx.lineTo(originX + GEM_W * p2, originY + GEM_H - gapV);
        ctx.lineTo(originX + GEM_W * p1, originY + GEM_H - gapV);
        ctx.lineTo(originX + gapH, originY + GEM_H * p2);
        ctx.lineTo(originX + gapH, originY + GEM_H * p1);
        ctx.closePath();
        ctx.fill();
      }
      break;

    // blue
    case COLORS[4]:
      {
        const gapH = 10;
        const gapV = 10;
        const p1 = 0.3;
        const p2 = 0.7;

        ctx.beginPath();
        ctx.moveTo(originX + GEM_W * p1, originY + gapV);
        ctx.lineTo(originX + GEM_W * p2, originY + gapV);
        ctx.lineTo(originX + GEM_W - gapH, originY + GEM_H * p1);
        ctx.lineTo(originX + GEM_W * 0.5, originY + GEM_H - gapV);
        ctx.lineTo(originX + gapH, originY + GEM_H * p1);
        ctx.closePath();

        ctx.fill();
      }
      break;

    // purple
    case COLORS[5]:
      {
        const gapH = 10;
        const gapV = 15;
        const p1 = 0.3;
        const p2 = 0.7;

        ctx.beginPath();
        ctx.moveTo(originX + GEM_W * 0.5, originY + gapV);
        ctx.lineTo(originX + GEM_W - gapH, originY + GEM_H - gapV);
        ctx.lineTo(originX + gapH, originY + GEM_H - gapV);
        ctx.closePath();

        ctx.fill();
      }
      break;

    // white
    case COLORS[6]:
      {
        const gap = 11;

        ctx.beginPath();
        ctx.arc(
          x * GEM_W + GEM_W / 2,
          y * GEM_H + GEM_H / 2,
          GEM_W / 2 - gap,
          0,
          Math.PI * 2
        );
        ctx.closePath();
        ctx.fill();
      }
      break;

    default:
      break;
  }
}

canvas.addEventListener("mousedown", function (e) {
  mousePressed = true;
  mouseClicked = true;
  mousePos = {
    x: Math.floor(e.offsetX / GEM_W),
    y: Math.floor(e.offsetY / GEM_H),
  };
});

window.addEventListener("mouseup", function () {
  mousePressed = false;
});

canvas.addEventListener("mousemove", function (e) {
  mousePos = {
    x: Math.floor(e.offsetX / GEM_W),
    y: Math.floor(e.offsetY / GEM_H),
  };
});

canvas.addEventListener("mouseleave", function (e) {
  mousePos = null;
});

window.addEventListener("keydown", function (e) {
  keyPressed[e.code] = true;
});
window.addEventListener("keyup", function (e) {
  keyPressed[e.code] = false;
});

initialize();
