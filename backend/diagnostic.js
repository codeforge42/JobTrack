#!/usr/bin/env node

/**
 * Diagnostic script to test OpenAI API connectivity and configuration
 * Usage: node diagnostic.js
 */

const OpenAI = require('openai');
const dotenv = require('dotenv');
const net = require('net');
const dns = require('dns').promises;

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(status, message) {
  const icon = status === 'success' ? '✓' : status === 'error' ? '✗' : status === 'warn' ? '⚠' : 'ℹ';
  const color = status === 'success' ? colors.green : status === 'error' ? colors.red : status === 'warn' ? colors.yellow : colors.blue;
  console.log(`${color}${icon} ${message}${colors.reset}`);
}

async function testDNS() {
  try {
    const ips = await dns.resolve4('api.openai.com');
    log('success', `DNS Resolution: api.openai.com resolves to ${ips[0]}`);
    return true;
  } catch (err) {
    log('error', `DNS Resolution failed: ${err.message}`);
    return false;
  }
}

async function testNetworkConnectivity() {
  return new Promise((resolve) => {
    const socket = net.createConnection(443, 'api.openai.com', () => {
      log('success', 'Network: Connection to api.openai.com:443 successful');
      socket.destroy();
      resolve(true);
    });

    socket.on('error', (err) => {
      log('error', `Network: Connection failed: ${err.message}`);
      resolve(false);
    });

    socket.setTimeout(5000, () => {
      log('error', 'Network: Connection timeout (5s)');
      socket.destroy();
      resolve(false);
    });
  });
}

async function testApiKeyFormat() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    log('error', 'Environment: OPENAI_API_KEY is not set');
    return false;
  }

  if (!apiKey.startsWith('sk-')) {
    log('error', `API Key format: Key should start with 'sk-', but starts with '${apiKey.substring(0, 5)}'`);
    return false;
  }

  if (apiKey.length < 20) {
    log('error', `API Key format: Key is too short (${apiKey.length} chars, expected ~60+)`);
    return false;
  }

  log('success', `API Key format: Valid format (${apiKey.length} characters)`);
  return true;
}

async function testOpenAIApi() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    log('error', 'OpenAI API test: Skipped (no API key)');
    return false;
  }

  try {
    const openai = new OpenAI({
      apiKey: apiKey,
      timeout: 30000,
      maxRetries: 1,
    });

    log('info', 'OpenAI API: Sending test request...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Respond with exactly: "OpenAI connection successful"',
        },
        { role: 'user', content: 'Test connection' },
      ],
      temperature: 0.1,
      max_tokens: 10,
    });

    log('success', 'OpenAI API: Authentication and connectivity working!');
    log('info', `Response: ${response.choices[0].message.content}`);
    return true;
  } catch (error) {
    if (error.status === 401) {
      log('error', `OpenAI API: Authentication failed (401) - Invalid or expired API key`);
    } else if (error.status === 429) {
      log('error', `OpenAI API: Rate limited (429) - Too many requests`);
    } else if (error.code === 'ECONNREFUSED') {
      log('error', `OpenAI API: Connection refused - Network issue`);
    } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      log('error', `OpenAI API: Connection timeout - Server unreachable`);
    } else if (error.code === 'ENOTFOUND') {
      log('error', `OpenAI API: DNS resolution failed - Cannot reach api.openai.com`);
    } else {
      log('error', `OpenAI API: ${error.message}`);
    }
    
    if (error.error?.message) {
      log('info', `Details: ${error.error.message}`);
    }
    return false;
  }
}

async function runDiagnostics() {
  console.log(`\n${colors.blue}═══════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}  OpenAI Connection Diagnostic${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════${colors.reset}\n`);

  const results = {
    dns: await testDNS(),
    network: await testNetworkConnectivity(),
    apiKeyFormat: await testApiKeyFormat(),
    apiAuth: await testOpenAIApi(),
  };

  console.log(`\n${colors.blue}═══════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}  Summary${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════${colors.reset}\n`);

  const allPassed = Object.values(results).every((r) => r === true);

  if (allPassed) {
    log('success', 'All checks passed! Your OpenAI connection is working.');
  } else {
    log('warn', 'Some checks failed. See details above for troubleshooting.');
    
    console.log(`\n${colors.yellow}Troubleshooting Tips:${colors.reset}`);
    
    if (!results.dns || !results.network) {
      console.log(`  1. Check your internet connection`);
      console.log(`  2. If behind a firewall/proxy, ensure api.openai.com is whitelisted`);
      console.log(`  3. Check if OpenAI API is experiencing outages (https://status.openai.com)`);
    }
    
    if (!results.apiKeyFormat) {
      console.log(`  1. Verify your OPENAI_API_KEY in .env file`);
      console.log(`  2. Ensure the key is from https://platform.openai.com/api-keys`);
      console.log(`  3. Check that the key has not expired or been revoked`);
    }
    
    if (results.apiKeyFormat && !results.apiAuth) {
      console.log(`  1. API key is invalid or expired - check at https://platform.openai.com/api-keys`);
      console.log(`  2. Ensure your account has available credits/billing`);
      console.log(`  3. Check that the key has the correct permissions`);
    }
  }

  console.log(`\n${colors.blue}═══════════════════════════════════════════${colors.reset}\n`);

  process.exit(allPassed ? 0 : 1);
}

runDiagnostics().catch((err) => {
  log('error', `Unexpected error: ${err.message}`);
  process.exit(1);
});
