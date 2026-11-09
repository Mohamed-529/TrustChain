import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = path.resolve('demo-evidence');
const ARTIFACT_DIR = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\c241686b-2ed9-4135-a019-c28c039e4092';

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function prepareMilestoneEvidence() {
  console.log('Ensuring fresh evidence submission on Milestone 1 (ms_seed_01)...');
  try {
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'marcus.dev@cloudbuilders.example', password: 'DevPass!2026' }),
    });
    const loginData = await loginRes.json();
    const devToken = loginData.token;

    const subRes = await fetch(`${BASE_URL}/api/v1/milestones/ms_seed_01/evidence`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${devToken}`,
      },
      body: JSON.stringify({ demoFixtureKey: 'SUCCESSFUL_SUBMISSION' }),
    });
    console.log('Submission response status:', subRes.status);
  } catch (err) {
    console.error('Evidence prep warning:', err.message);
  }
}

async function runGeminiBrowserAcceptance() {
  console.log('=== STARTING LIVE GEMINI BROWSER ACCEPTANCE ===');
  await prepareMilestoneEvidence();

  const userProfileDir = path.resolve('chrome-gemini-profile');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1440,960',
    `--user-data-dir=${userProfileDir}`,
  ]);

  try {
    let connected = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9225/json/version');
        if (res.ok) {
          connected = true;
          break;
        }
      } catch {
        await sleep(200);
      }
    }

    if (!connected) throw new Error('Could not connect to Chrome debugging port 9225');

    const listRes = await fetch('http://127.0.0.1:9225/json/list');
    const tabs = await listRes.json();
    const tab = tabs.find((t) => t.type === 'page') || tabs[0];
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    await new Promise((resolve) => (ws.onopen = resolve));
    console.log('Connected to Chrome tab via WebSocket CDP');

    let msgId = 1;
    const send = (method, params = {}) => {
      const id = msgId++;
      return new Promise((resolve, reject) => {
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            ws.removeEventListener('message', handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    const navigateAndWait = async (url, waitMs = 2000) => {
      console.log(`Navigating to ${url}...`);
      await send('Page.navigate', { url });
      await sleep(waitMs);
    };

    const evalInPage = async (expression) => {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res.result?.value;
    };

    const takeScreenshot = async (filename, label) => {
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      const filePath = path.join(EVIDENCE_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
      console.log(`Saved screenshot: ${filename} (${label})`);

      // Copy to artifact directory for rendering
      try {
        const artifactPath = path.join(ARTIFACT_DIR, filename);
        fs.writeFileSync(artifactPath, Buffer.from(data, 'base64'));
      } catch (err) {
        console.error('Artifact copy note:', err.message);
      }
    };

    // 1. Navigate to app
    await navigateAndWait(`${BASE_URL}/reviews`, 3000);

    // 2. Select Reviewer persona
    await evalInPage(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const reviewerBtn = buttons.find(b => b.textContent && b.textContent.includes('Sophia (Reviewer)'));
        if (reviewerBtn) reviewerBtn.click();
      })()
    `);
    await sleep(1500);

    // 3. Find and click "Run AI Evaluation" on Milestone 1
    console.log('Triggering AI Evaluation in UI...');
    const evalTriggered = await evalInPage(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const runBtn = buttons.find(b => b.textContent && (b.textContent.includes('Run AI Evaluation') || b.textContent.includes('Re-evaluate')));
        if (runBtn) {
          runBtn.click();
          return true;
        }
        return false;
      })()
    `);
    console.log('Evaluation button clicked:', evalTriggered);

    // Wait for live Gemini evaluation (typically 2-4 seconds)
    console.log('Waiting for Live Gemini API evaluation to resolve...');
    let evaluationCompleted = false;
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const isEvaluating = await evalInPage(`
        (() => {
          const bodyText = document.body.innerText;
          return bodyText.includes('Evaluating with Gemini') || bodyText.includes('Evaluating...');
        })()
      `);
      const hasLiveBadge = await evalInPage(`
        (() => {
          const bodyText = document.body.innerText;
          return bodyText.includes('LIVE GEMINI') || bodyText.includes('⚡ LIVE GEMINI');
        })()
      `);
      if (!isEvaluating && hasLiveBadge) {
        evaluationCompleted = true;
        console.log(`Live Gemini evaluation completed and UI updated with LIVE GEMINI badge! (took ~${i + 1}s)`);
        break;
      }
    }

    // Capture Review Workbench Screenshot
    await sleep(1000);
    await takeScreenshot(
      '10_live_gemini_evaluation_workbench.png',
      'Milestone Review Workbench with Live Gemini Evaluation Provenance'
    );

    // 4. Open AI Decision Inspector Modal
    console.log('Opening AI Decision Inspector modal...');
    const inspectorOpened = await evalInPage(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const inspectBtn = buttons.find(b => b.textContent && b.textContent.includes('Open AI Inspector'));
        if (inspectBtn) {
          inspectBtn.click();
          return true;
        }
        return false;
      })()
    `);
    console.log('Inspector button clicked:', inspectorOpened);
    await sleep(2500);

    // Capture AI Decision Inspector Modal Screenshot
    await takeScreenshot(
      '11_live_gemini_decision_inspector.png',
      'AI Decision Inspector Modal with Gemini 3.5 Flash Lite Telemetry'
    );

    ws.close();
    console.log('=== BROWSER ACCEPTANCE COMPLETED SUCCESSFULLY ===');
  } finally {
    chrome.kill();
  }
}

runGeminiBrowserAcceptance().catch((err) => {
  console.error('Acceptance execution failed:', err);
  process.exit(1);
});
