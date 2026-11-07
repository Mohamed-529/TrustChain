import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Phase 8.1 — Bryntum Gantt Foundation & Integration Verification', async (t) => {
  await t.test('1. resolves official Bryntum Gantt packages, types, and stylesheets', () => {
    // Check @bryntum/gantt
    const ganttPkgPath = path.resolve(process.cwd(), 'node_modules', '@bryntum', 'gantt', 'package.json');
    assert.ok(fs.existsSync(ganttPkgPath), 'node_modules/@bryntum/gantt must exist');
    const ganttPkg = JSON.parse(fs.readFileSync(ganttPkgPath, 'utf8'));
    assert.ok(
      ganttPkg.name === '@bryntum/gantt' || ganttPkg.name === '@bryntum/gantt-trial',
      'Package name must be @bryntum/gantt or @bryntum/gantt-trial'
    );

    // Check @bryntum/gantt-react
    const reactPkgPath = path.resolve(process.cwd(), 'node_modules', '@bryntum', 'gantt-react', 'package.json');
    assert.ok(fs.existsSync(reactPkgPath), 'node_modules/@bryntum/gantt-react must exist');
    const reactPkg = JSON.parse(fs.readFileSync(reactPkgPath, 'utf8'));
    assert.equal(reactPkg.name, '@bryntum/gantt-react');
    assert.equal(reactPkg.version, '7.3.8');

    // Check stylesheets
    const ganttCss = path.resolve(process.cwd(), 'node_modules', '@bryntum', 'gantt', 'gantt.css');
    const themeCss = path.resolve(process.cwd(), 'node_modules', '@bryntum', 'gantt', 'stockholm-light.css');
    assert.ok(fs.existsSync(ganttCss), 'gantt.css must exist');
    assert.ok(fs.existsSync(themeCss), 'stockholm-light.css must exist');
    assert.ok(fs.statSync(ganttCss).size > 100000, 'gantt.css must be full stylesheet');
  });

  await t.test('2. verifies Bryntum component source integrity, baseline & dependency features', () => {
    const componentPath = path.resolve(process.cwd(), 'src', 'components', 'BryntumGanttViewer.tsx');
    assert.ok(fs.existsSync(componentPath), 'BryntumGanttViewer.tsx must exist');
    const source = fs.readFileSync(componentPath, 'utf8');

    // Verify genuine wrapper imports
    assert.ok(source.includes("import { BryntumGantt } from '@bryntum/gantt-react';"), 'Must import BryntumGantt from @bryntum/gantt-react');
    assert.ok(source.includes("import '@bryntum/gantt/gantt.css';"), 'Must import gantt.css');
    assert.ok(source.includes("import '@bryntum/gantt/stockholm-light.css';"), 'Must import stockholm-light.css');

    // Verify feature flags configured
    assert.ok(source.includes('baselinesFeature={{ disabled: false }}'), 'Must enable baselinesFeature');
    assert.ok(source.includes('dependenciesFeature={{ disabled: false }}'), 'Must enable dependenciesFeature');
    assert.ok(source.includes('criticalPathsFeature={{ disabled: false }}'), 'Must enable criticalPathsFeature');

    // Verify Finish-to-Start dependency type (type = 2 in Bryntum)
    assert.ok(source.includes('type: 2'), 'Must specify Finish-to-Start dependency type 2');
    assert.ok(source.includes('Contract Baseline'), 'Must reference Contract Baseline');
  });

  await t.test('3. verifies Vite bundling of Bryntum Gantt React component', async () => {
    const { build } = await import('vite');
    const tempOutDir = path.resolve(process.cwd(), 'node_modules', '.temp_bryntum_build');
    const buildResult = await build({
      configFile: false,
      build: {
        lib: {
          entry: 'src/components/BryntumGanttViewer.tsx',
          formats: ['es'],
          fileName: 'bryntum-test',
        },
        rollupOptions: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
        },
        outDir: tempOutDir,
        emptyOutDir: true,
      },
      logLevel: 'silent',
    });

    assert.ok(buildResult, 'Vite build must produce build output');
    const bundleJs = path.join(tempOutDir, 'bryntum-test.js');
    const bundleCss = path.join(tempOutDir, 'bryntum-test.css');
    assert.ok(fs.existsSync(bundleJs), 'bryntum-test.js bundle must be emitted');
    assert.ok(fs.existsSync(bundleCss), 'bryntum-test.css bundle must be emitted');
    assert.ok(fs.statSync(bundleJs).size > 1000000, 'JS bundle must include Bryntum engine');
    assert.ok(fs.statSync(bundleCss).size > 100000, 'CSS bundle must include Bryntum stylesheets');

    // Clean up temporary build artifacts
    fs.rmSync(tempOutDir, { recursive: true, force: true });
  });
});
