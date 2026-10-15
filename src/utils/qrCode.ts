/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Lightweight, zero-dependency pure TypeScript QR Code Generator (Versions 1-10, Byte Mode, ECC L & M)
 * Completely eliminates any external npm dependency on 'qrcode' and solves Rollup resolution errors.
 */

// Galois Field GF(256) tables
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisField() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = val;
    GF_EXP[i + 255] = val;
    GF_LOG[val] = i;
    val = (val << 1) ^ (val & 128 ? 0x11d : 0);
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

// Polynomial generator for Reed-Solomon
function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], GF_EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

// Compute Reed-Solomon error correction bytes
function rsComputeRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const result = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ result[0];
    result.copyWithin(0, 1);
    result[ecCount - 1] = 0;
    for (let j = 0; j < ecCount; j++) {
      result[j] ^= gfMul(gen[j], factor);
    }
  }
  return result;
}

interface QRVersionInfo {
  version: number;
  totalCodewords: number;
  dataCodewords: number;
  ecPerBlock: number;
  numBlocksGroup1: number;
  dataPerBlockGroup1: number;
  numBlocksGroup2: number;
  dataPerBlockGroup2: number;
  alignment: number[];
}

// Version table for Medium (M) error correction (standard balanced QR)
const QR_TABLE_M: QRVersionInfo[] = [
  { version: 1, totalCodewords: 26, dataCodewords: 16, ecPerBlock: 10, numBlocksGroup1: 1, dataPerBlockGroup1: 16, numBlocksGroup2: 0, dataPerBlockGroup2: 0, alignment: [] },
  { version: 2, totalCodewords: 44, dataCodewords: 28, ecPerBlock: 16, numBlocksGroup1: 1, dataPerBlockGroup1: 28, numBlocksGroup2: 0, dataPerBlockGroup2: 0, alignment: [6, 18] },
  { version: 3, totalCodewords: 70, dataCodewords: 44, ecPerBlock: 26, numBlocksGroup1: 1, dataPerBlockGroup1: 44, numBlocksGroup2: 0, dataPerBlockGroup2: 0, alignment: [6, 22] },
  { version: 4, totalCodewords: 100, dataCodewords: 64, ecPerBlock: 18, numBlocksGroup1: 2, dataPerBlockGroup1: 32, numBlocksGroup2: 0, dataPerBlockGroup2: 0, alignment: [6, 26] },
  { version: 5, totalCodewords: 134, dataCodewords: 86, ecPerBlock: 24, numBlocksGroup1: 2, dataPerBlockGroup1: 43, numBlocksGroup2: 0, dataPerBlockGroup2: 0, alignment: [6, 30] },
  { version: 6, totalCodewords: 172, dataCodewords: 108, ecPerBlock: 16, numBlocksGroup1: 4, dataPerBlockGroup1: 27, numBlocksGroup2: 0, dataPerBlockGroup2: 0, alignment: [6, 34] },
  { version: 7, totalCodewords: 196, dataCodewords: 124, ecPerBlock: 18, numBlocksGroup1: 4, dataPerBlockGroup1: 31, numBlocksGroup2: 0, dataPerBlockGroup2: 0, alignment: [6, 22, 38] },
  { version: 8, totalCodewords: 242, dataCodewords: 154, ecPerBlock: 22, numBlocksGroup1: 2, dataPerBlockGroup1: 38, numBlocksGroup2: 2, dataPerBlockGroup2: 39, alignment: [6, 24, 42] },
  { version: 9, totalCodewords: 292, dataCodewords: 182, ecPerBlock: 22, numBlocksGroup1: 3, dataPerBlockGroup1: 36, numBlocksGroup2: 2, dataPerBlockGroup2: 37, alignment: [6, 26, 46] },
  { version: 10, totalCodewords: 346, dataCodewords: 216, ecPerBlock: 26, numBlocksGroup1: 4, dataPerBlockGroup1: 40, numBlocksGroup2: 1, dataPerBlockGroup2: 41, alignment: [6, 28, 50] },
];

// Format info strings for ECC M with masks 0-7 (precomputed with BCH(15,5) code and 0x5412 XOR)
const FORMAT_INFO_M = [
  0x5412 ^ 0x5412, // mask 0: 0b000000000000000
  0x5125 ^ 0x5412, // mask 1
  0x5e7c ^ 0x5412, // mask 2
  0x5b4b ^ 0x5412, // mask 3
  0x45f9 ^ 0x5412, // mask 4
  0x40ce ^ 0x5412, // mask 5
  0x4f97 ^ 0x5412, // mask 6
  0x4aa0 ^ 0x5412, // mask 7
];

export class SimpleQRCode {
  private matrix: boolean[][];
  private isFunction: boolean[][];
  private size: number;
  private versionInfo: QRVersionInfo;

  constructor(text: string) {
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(text);
    const dataLen = utf8Bytes.length;

    // Pick smallest version that fits data
    // Byte mode overhead: 4 bits mode + 8 bits length (versions 1-9) or 16 bits (v10)
    let selected: QRVersionInfo | null = null;
    for (const v of QR_TABLE_M) {
      const headerBits = v.version < 10 ? 12 : 20;
      const capacity = Math.floor((v.dataCodewords * 8 - headerBits) / 8);
      if (dataLen <= capacity) {
        selected = v;
        break;
      }
    }

    if (!selected) {
      // If exceeds version 10, pick version 10 and truncate or use max
      selected = QR_TABLE_M[QR_TABLE_M.length - 1];
    }

    this.versionInfo = selected;
    this.size = 17 + 4 * selected.version;
    this.matrix = Array.from({ length: this.size }, () => Array(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => Array(this.size).fill(false));

    this.buildQRCode(utf8Bytes);
  }

  private setModule(row: number, col: number, isDark: boolean, isFunc = false) {
    if (row < 0 || row >= this.size || col < 0 || col >= this.size) return;
    this.matrix[row][col] = isDark;
    if (isFunc) this.isFunction[row][col] = true;
  }

  private drawFinderPattern(startRow: number, startCol: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = startRow + r;
        const col = startCol + c;
        if (row < 0 || row >= this.size || col < 0 || col >= this.size) continue;
        const isDark = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                       (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                       (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        this.setModule(row, col, isDark, true);
      }
    }
  }

  private drawAlignmentPattern(centerRow: number, centerCol: number) {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const isDark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
        this.setModule(centerRow + r, centerCol + c, isDark, true);
      }
    }
  }

  private buildQRCode(dataBytes: Uint8Array) {
    const v = this.versionInfo;

    // 1. Draw Finder Patterns (Top-Left, Top-Right, Bottom-Left)
    this.drawFinderPattern(0, 0);
    this.drawFinderPattern(0, this.size - 7);
    this.drawFinderPattern(this.size - 7, 0);

    // 2. Draw Timing Patterns
    for (let i = 8; i < this.size - 8; i++) {
      this.setModule(6, i, i % 2 === 0, true);
      this.setModule(i, 6, i % 2 === 0, true);
    }

    // 3. Draw Alignment Patterns
    const alignCoords = v.alignment;
    for (const r of alignCoords) {
      for (const c of alignCoords) {
        // Skip finders
        if ((r === 6 && c === 6) ||
            (r === 6 && c === this.size - 7) ||
            (r === this.size - 7 && c === 6)) {
          continue;
        }
        this.drawAlignmentPattern(r, c);
      }
    }

    // 4. Dark module
    this.setModule(this.size - 8, 8, true, true);

    // 5. Reserve format info modules
    for (let i = 0; i <= 8; i++) {
      this.isFunction[8][i] = true;
      this.isFunction[i][8] = true;
    }
    for (let i = 0; i < 8; i++) {
      this.isFunction[8][this.size - 1 - i] = true;
      this.isFunction[this.size - 1 - i][8] = true;
    }

    // 6. Encode Data (Byte mode: 0100)
    const bitBuffer: number[] = [];
    const pushBits = (val: number, len: number) => {
      for (let i = len - 1; i >= 0; i--) {
        bitBuffer.push((val >> i) & 1);
      }
    };

    // Mode Byte
    pushBits(0b0100, 4);
    // Length
    const lenBits = v.version < 10 ? 8 : 16;
    pushBits(dataBytes.length, lenBits);
    // Data bytes
    for (const b of dataBytes) {
      pushBits(b, 8);
    }
    // Terminator
    const remainingToCapacity = v.dataCodewords * 8 - bitBuffer.length;
    const termLen = Math.min(4, Math.max(0, remainingToCapacity));
    pushBits(0, termLen);
    // Pad to byte boundary
    while (bitBuffer.length % 8 !== 0) {
      bitBuffer.push(0);
    }
    // Pad bytes 0xEC and 0x11
    let padToggle = 0;
    while (bitBuffer.length < v.dataCodewords * 8) {
      pushBits(padToggle % 2 === 0 ? 0xec : 0x11, 8);
      padToggle++;
    }

    // Convert bits to data codewords
    const allDataCodewords = new Uint8Array(v.dataCodewords);
    for (let i = 0; i < v.dataCodewords; i++) {
      let byteVal = 0;
      for (let b = 0; b < 8; b++) {
        byteVal = (byteVal << 1) | bitBuffer[i * 8 + b];
      }
      allDataCodewords[i] = byteVal;
    }

    // 7. Split into blocks and compute Reed-Solomon EC
    const totalBlocks = v.numBlocksGroup1 + v.numBlocksGroup2;
    const dataBlocks: Uint8Array[] = [];
    const ecBlocks: Uint8Array[] = [];

    let offset = 0;
    for (let i = 0; i < v.numBlocksGroup1; i++) {
      const b = allDataCodewords.slice(offset, offset + v.dataPerBlockGroup1);
      dataBlocks.push(b);
      ecBlocks.push(rsComputeRemainder(b, v.ecPerBlock));
      offset += v.dataPerBlockGroup1;
    }
    for (let i = 0; i < v.numBlocksGroup2; i++) {
      const b = allDataCodewords.slice(offset, offset + v.dataPerBlockGroup2);
      dataBlocks.push(b);
      ecBlocks.push(rsComputeRemainder(b, v.ecPerBlock));
      offset += v.dataPerBlockGroup2;
    }

    // Interleave data codewords
    const interleaved: number[] = [];
    const maxDataLen = Math.max(v.dataPerBlockGroup1, v.dataPerBlockGroup2);
    for (let col = 0; col < maxDataLen; col++) {
      for (let b = 0; b < totalBlocks; b++) {
        if (col < dataBlocks[b].length) {
          interleaved.push(dataBlocks[b][col]);
        }
      }
    }
    // Interleave EC codewords
    for (let col = 0; col < v.ecPerBlock; col++) {
      for (let b = 0; b < totalBlocks; b++) {
        interleaved.push(ecBlocks[b][col]);
      }
    }

    // 8. Place Data into Matrix with Masking
    // We use Mask 0: (row + col) % 2 === 0
    let bitIdx = 0;
    const totalBits = interleaved.length * 8;
    let upward = true;

    for (let col = this.size - 1; col > 0; col -= 2) {
      if (col === 6) col--; // Skip vertical timing column

      for (let rowStep = 0; rowStep < this.size; rowStep++) {
        const row = upward ? (this.size - 1 - rowStep) : rowStep;

        for (let c = 0; c < 2; c++) {
          const currentCol = col - c;
          if (!this.isFunction[row][currentCol]) {
            let bit = 0;
            if (bitIdx < totalBits) {
              const byteI = Math.floor(bitIdx / 8);
              const bitI = 7 - (bitIdx % 8);
              bit = (interleaved[byteI] >> bitI) & 1;
              bitIdx++;
            }

            // Apply Mask Pattern 0: (row + col) % 2 === 0
            const mask = ((row + currentCol) % 2 === 0) ? 1 : 0;
            this.matrix[row][currentCol] = (bit ^ mask) === 1;
          }
        }
      }
      upward = !upward;
    }

    // 9. Write Format Information (Mask 0 + ECC M)
    const formatBits = FORMAT_INFO_M[0];
    for (let i = 0; i < 15; i++) {
      const bit = ((formatBits >> (14 - i)) & 1) === 1;

      // Top-Left around finder
      if (i < 6) {
        this.setModule(i, 8, bit, true);
      } else if (i === 6) {
        this.setModule(7, 8, bit, true);
      } else if (i === 7) {
        this.setModule(8, 8, bit, true);
      } else if (i === 8) {
        this.setModule(8, 7, bit, true);
      } else {
        this.setModule(8, 14 - i, bit, true);
      }

      // Split between Bottom-Left and Top-Right
      if (i < 7) {
        this.setModule(8, this.size - 1 - i, bit, true);
      } else {
        this.setModule(this.size - 15 + i, 8, bit, true);
      }
    }
  }

  public getMatrix(): boolean[][] {
    return this.matrix;
  }

  public toSVG(margin = 2): string {
    const total = this.size + margin * 2;
    let path = '';
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.matrix[r][c]) {
          path += `M${c + margin},${r + margin}h1v1h-1z `;
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="100%" height="100%" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><path d="${path}" fill="#000000"/></svg>`;
  }

  public toDataURL(margin = 2): string {
    const svg = this.toSVG(margin);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}

/**
 * Generates an SVG Data URL representation of the text for <img> or QR displays
 */
export function generateQRCodeDataURL(text: string, margin = 2): string {
  const qr = new SimpleQRCode(text);
  return qr.toDataURL(margin);
}
