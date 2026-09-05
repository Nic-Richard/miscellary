# Builds seamless, neutral card stock textures under apps/web/public/materials.
# Each tile is grey centred on 128 for use with mix-blend-mode: overlay, where
# mid grey leaves the underlying colour untouched. One tile can therefore
# texture cream stock, ink stock and gold foil.
#
# Everything wraps by construction: the weaves use pitches that divide the tile,
# and the noise lattice indexes modulo its period. The pixel loop is C# because
# a per-pixel PowerShell function call is far too slow at this size.
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path (Join-Path $PSScriptRoot '..') 'apps\web\public\materials'

Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class CardTextures {
    const int TILE = 160;

    // Deterministic hash -> 0..1, so a rebuild produces identical files.
    static double Rand(int x, int y, int seed) {
        unchecked {
            uint n = (uint)(x * 374761393 + y * 668265263 + seed * 1013904223);
            n ^= n >> 13;
            n *= 1274126177u;
            n ^= n >> 16;
            return (n % 100000u) / 100000.0;
        }
    }

    // Value noise on a torus: the lattice is indexed modulo period, so the left
    // edge interpolates back into the right edge and the tile repeats cleanly.
    static double Noise(double x, double y, int period, int seed) {
        double cell = (double)TILE / period;
        double fx = x / cell, fy = y / cell;
        double x0 = Math.Floor(fx), y0 = Math.Floor(fy);
        double tx = fx - x0, ty = fy - y0;
        tx = tx * tx * (3 - 2 * tx);   // smoothstep, so the lattice does not
        ty = ty * ty * (3 - 2 * ty);   // show through as diamonds
        int ix0 = ((int)x0 % period + period) % period;
        int iy0 = ((int)y0 % period + period) % period;
        int ix1 = (ix0 + 1) % period, iy1 = (iy0 + 1) % period;
        double a = Rand(ix0, iy0, seed) + (Rand(ix1, iy0, seed) - Rand(ix0, iy0, seed)) * tx;
        double b = Rand(ix0, iy1, seed) + (Rand(ix1, iy1, seed) - Rand(ix0, iy1, seed)) * tx;
        return a + (b - a) * ty;
    }

    // An over-under weave. Whichever thread is on top catches the light along
    // its length, and the gap where neither thread is proud reads as shadow,
    // which is what stops a weave looking like a checkerboard. Whole threads
    // also run slightly light or dark, the way real yarn varies down its run.
    static double Weave(int x, int y, int pitch, double lift, double dip, int seed) {
        int ix = x / pitch, iy = y / pitch;
        bool warpOver = (ix + iy) % 2 == 0;
        double rx = Math.Sin(((x % pitch) / (double)pitch) * Math.PI);
        double ry = Math.Sin(((y % pitch) / (double)pitch) * Math.PI);
        double v = lift * (warpOver ? rx : ry) - dip * (1 - Math.Max(rx, ry));
        v += (Rand(ix, 0, seed) - 0.5) * 4.5;      // warp thread tone
        v += (Rand(0, iy, seed + 1) - 0.5) * 4.5;  // weft thread tone
        return v;
    }

    static double Shade(string kind, int x, int y) {
        switch (kind) {
            case "linen":
                return 128 + Weave(x, y, 8, 16, 13, 11) + (Noise(x, y, 40, 71) - 0.5) * 9;
            case "canvas":
                return 128 + Weave(x, y, 16, 25, 21, 23)
                    + (Noise(x, y, 20, 43) - 0.5) * 20
                    + (Rand(x, y, 5) - 0.5) * 13;
            case "grain":
                return 128 + (Rand(x, y, 7) - 0.5) * 29
                    + (Noise(x, y, 80, 3) - 0.5) * 20
                    + (Noise(x, y, 16, 91) - 0.5) * 11;
            case "felt":
                return 128 + (Noise(x, y, 8, 31) - 0.5) * 33
                    + (Noise(x, y, 20, 47) - 0.5) * 18
                    + (Rand(x, y, 13) - 0.5) * 7;
            case "brushed":
                // streaks run down the card, so the noise is stretched along y
                return 128 + (Noise(x, y * 0.06, 160, 59) - 0.5) * 46
                    + (Rand(x, y / 3, 17) - 0.5) * 15
                    + Math.Sin(x / (double)TILE * Math.PI * 2) * 5;
        }
        return 128;
    }

    public static void Write(string kind, string path) {
        var bmp = new Bitmap(TILE, TILE, PixelFormat.Format24bppRgb);
        var rect = new Rectangle(0, 0, TILE, TILE);
        var data = bmp.LockBits(rect, ImageLockMode.WriteOnly, bmp.PixelFormat);
        var bytes = new byte[data.Stride * TILE];
        for (int y = 0; y < TILE; y++) {
            for (int x = 0; x < TILE; x++) {
                double v = Shade(kind, x, y);
                byte b = (byte)Math.Max(0, Math.Min(255, Math.Round(v)));
                int i = y * data.Stride + x * 3;
                bytes[i] = b; bytes[i + 1] = b; bytes[i + 2] = b;
            }
        }
        Marshal.Copy(bytes, 0, data.Scan0, bytes.Length);
        bmp.UnlockBits(data);
        bmp.Save(path, ImageFormat.Png);
        bmp.Dispose();
    }
}
'@ -ReferencedAssemblies System.Drawing

foreach ($kind in 'linen', 'canvas', 'grain', 'felt', 'brushed') {
  $path = Join-Path $outDir "tex-$kind.png"
  [CardTextures]::Write($kind, $path)
  Write-Host "wrote tex-$kind.png"
}
Write-Host 'card textures done'
