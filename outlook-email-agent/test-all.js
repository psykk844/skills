require('dotenv').config();
const EmailClassifier = require('./emailClassifier');
const ReplyDrafter = require('./replyDrafter');

async function testClassifier() {
  console.log('=== Testing Email Classifier ===\n');
  
  const classifier = new EmailClassifier();
  
  const testCases = [
    {
      name: 'Question email',
      email: {
        sender: 'john@example.com',
        subject: 'Can we schedule a meeting?',
        body: 'Hi, are you available tomorrow at 2pm for a quick sync?'
      },
      expected: true
    },
    {
      name: 'Free for meeting request',
      email: {
        sender: 'sarah@example.com',
        subject: 'Free for a meeting at 4pm?',
        body: 'I have some questions about the project deadline. Are you available?'
      },
      expected: true
    },
    {
      name: 'FYI email',
      email: {
        sender: 'updates@example.com',
        subject: 'FYI: Project updates',
        body: 'Just letting you know that the project is on track. No action needed.'
      },
      expected: false
    },
    {
      name: 'Meeting invitation accepted',
      email: {
        sender: 'calendar@example.com',
        subject: 'Meeting Invitation Accepted',
        body: 'Your meeting request has been accepted by all participants.'
      },
      expected: false
    },
    {
      name: 'Urgent request',
      email: {
        sender: 'manager@example.com',
        subject: 'URGENT: Review needed',
        body: 'Please review this document ASAP. We need it by end of day.'
      },
      expected: true
    },
    {
      name: 'Invoice receipt',
      email: {
        sender: 'billing@example.com',
        subject: 'Invoice #12345',
        body: 'Receipt of payment for your subscription. Total: $50.00'
      },
      expected: false
    },
    {
      name: 'Feedback request',
      email: {
        sender: 'colleague@example.com',
        subject: 'Your thoughts on this proposal?',
        body: 'I wanted to get your feedback on the new proposal draft.'
      },
      expected: true
    },
    {
      name: 'Newsletter',
      email: {
        sender: 'newsletter@example.com',
        subject: 'Weekly Tech Newsletter',
        body: 'This week in tech news: AI developments, new gadgets, and industry updates.'
      },
      expected: false
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    const result = classifier.classify(testCase.email);
    const status = result.needsReply === testCase.expected ? '✅ PASS' : '❌ FAIL';
    
    if (result.needsReply === testCase.expected) {
      passed++;
    } else {
      failed++;
    }
    
    console.log(`${status} - ${testCase.name}`);
    console.log(`    Subject: "${testCase.email.subject}"`);
    console.log(`    Expected: ${testCase.expected}, Got: ${result.needsReply}`);
    console.log('');
  }
  
  console.log(`\n=== Results ===`);
  console.log(`Total: ${testCases.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);
  
  return failed === 0;
}

async function testReplyDrafter() {
  console.log('\n=== Testing Reply Drafter ===\n');
  
  const drafter = new ReplyDrafter();
  
  const testEmail = {
    sender: 'test@example.com',
    subject: 'Can you help with this?',
    body: 'I have a question about the project timeline. When can we discuss this?'
  };
  
  try {
    const consoleLog = console.log;
    console.log = function(...args) {
      if (args[0] && args[0].includes('[API')) {
        return;
      }
      consoleLog.apply(console, args);
    };
    
    const reply = await drafter.draftReply(testEmail, { level: 'high' });
    
    console.log = consoleLog;
    console.log('✅ Reply generated successfully:');
    console.log('---');
    console.log(reply);
    console.log('---');
    console.log(`Length: ${reply.length} characters`);
    console.log(`Lines: ${reply.split('\n').length} lines`);
    
    return true;
  } catch (error) {
    console.log('❌ Reply generation failed:');
    console.log(`Error: ${error.message}`);
    console.log(`Status: ${error.status}`);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Outlook Email Agent Test Suite\n');
  
  const classifierPassed = await testClassifier();
  const drafterPassed = await testReplyDrafter();
  
  console.log('\n=== Final Summary ===');
  console.log(`Email Classifier: ${classifierPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Reply Drafter:     ${drafterPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  if (classifierPassed && drafterPassed) {
    console.log('\n🎉 All tests passed! The agent is ready to use.');
    console.log('\nNext steps:');
    console.log('1. Run "npm run setup" to login to Outlook (one-time)');
    console.log('2. Run "npm start" to start the email agent');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
  }
}

runTests().catch(console.error);
