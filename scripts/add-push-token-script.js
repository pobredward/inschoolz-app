#!/usr/bin/env node
/**
 * 특정 사용자에게 푸시 토큰을 수동으로 추가하는 스크립트
 */

const admin = require('firebase-admin');
const path = require('path');

// Firebase Admin SDK 초기화
const serviceAccount = require('../../shared/credentials/inschoolz-firebase-adminsdk-p6trg-c275cfa0f4.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://inschoolz-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

async function addPushTokenToUser(userId, pushToken, platform = 'ios') {
  try {
    console.log(`📱 사용자 ${userId}에게 푸시 토큰 추가 중...`);
    console.log(`🔑 토큰: ${pushToken}`);
    console.log(`📋 플랫폼: ${platform}`);
    
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.error(`❌ 사용자 ${userId}를 찾을 수 없습니다.`);
      return false;
    }
    
    const userData = userDoc.data();
    console.log(`👤 사용자 정보: ${userData?.profile?.userName || '이름 없음'}`);
    
    // 기존 푸시 토큰 가져오기
    const existingPushTokens = userData.pushTokens || {};
    
    // 새 토큰 추가 (deviceId null 값 방지)
    const tokenData = {
      token: pushToken,
      platform: platform,
      deviceId: 'manual-added-script',
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
      addedBy: 'admin-script'
    };
    
    const updatedPushTokens = {
      ...existingPushTokens,
      [platform]: tokenData
    };
    
    // Firestore 업데이트
    await userRef.update({
      pushTokens: updatedPushTokens,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ 푸시 토큰이 성공적으로 추가되었습니다!');
    console.log('📊 업데이트된 토큰 정보:', updatedPushTokens);
    
    return true;
  } catch (error) {
    console.error('❌ 푸시 토큰 추가 실패:', error);
    return false;
  }
}

async function testPushNotification(pushToken) {
  try {
    console.log('\n🧪 추가된 토큰으로 테스트 푸시 알림 발송 중...');
    
    const message = {
      to: pushToken,
      sound: 'default',
      title: '🎉 토큰 추가 완료!',
      body: '푸시 토큰이 성공적으로 추가되었습니다. 이제 관리자 패널에서 알림을 받을 수 있습니다!',
      data: {
        testType: 'token-added',
        timestamp: Date.now(),
        source: 'admin-script'
      },
      priority: 'high',
      android: {
        channelId: 'default',
        sound: true,
        priority: 'high',
        vibrate: true,
        color: '#FF231F7C',
      },
      ios: {
        sound: true,
        _displayInForeground: true,
      },
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ 테스트 푸시 알림 발송 성공!');
      console.log('📊 결과:', result);
    } else {
      console.error('❌ 테스트 푸시 알림 발송 실패:', result);
    }
  } catch (error) {
    console.error('🚨 테스트 푸시 알림 오류:', error);
  }
}

async function listAllUsers() {
  try {
    console.log('👥 모든 사용자 목록 조회 중...\n');
    
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('📭 등록된 사용자가 없습니다.');
      return;
    }
    
    console.log(`📊 총 ${usersSnapshot.size}명의 사용자가 등록되어 있습니다.\n`);
    
    usersSnapshot.docs.forEach((doc, index) => {
      const userData = doc.data();
      const pushTokens = userData.pushTokens || {};
      const hasTokens = Object.keys(pushTokens).length > 0;
      
      console.log(`${index + 1}. ID: ${doc.id}`);
      console.log(`   이름: ${userData?.profile?.userName || '이름 없음'}`);
      console.log(`   실명: ${userData?.profile?.realName || '실명 없음'}`);
      console.log(`   이메일: ${userData?.profile?.email || '이메일 없음'}`);
      console.log(`   역할: ${userData?.role || 'user'}`);
      console.log(`   푸시 토큰: ${hasTokens ? '✅ 있음' : '❌ 없음'}`);
      
      if (hasTokens) {
        Object.entries(pushTokens).forEach(([platform, tokenData]) => {
          console.log(`     ${platform}: ${tokenData.token?.substring(0, 30)}...`);
        });
      }
      console.log('');
    });
  } catch (error) {
    console.error('❌ 사용자 목록 조회 실패:', error);
  }
}

// 메인 실행 함수
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🔧 푸시 토큰 관리 스크립트');
    console.log('='  .repeat(50));
    console.log('');
    console.log('사용법:');
    console.log('  node add-push-token-script.js list                           # 모든 사용자 목록 조회');
    console.log('  node add-push-token-script.js add [USER_ID] [PUSH_TOKEN]     # 푸시 토큰 추가');
    console.log('  node add-push-token-script.js test [PUSH_TOKEN]              # 푸시 토큰 테스트');
    console.log('');
    console.log('예시:');
    console.log('  node add-push-token-script.js add kgfWa3onhhCBh2sLxiUWw19JWR2 ExponentPushToken[rbeXluMvIYC00bSztq8s5T]');
    console.log('  node add-push-token-script.js test ExponentPushToken[rbeXluMvIYC00bSztq8s5T]');
    return;
  }
  
  const command = args[0];
  
  if (command === 'list') {
    await listAllUsers();
  } else if (command === 'add') {
    const userId = args[1];
    const pushToken = args[2];
    const platform = args[3] || 'ios'; // 기본값 iOS
    
    if (!userId || !pushToken) {
      console.error('❌ 사용자 ID와 푸시 토큰을 모두 입력해주세요.');
      console.log('사용법: node add-push-token-script.js add [USER_ID] [PUSH_TOKEN] [PLATFORM]');
      return;
    }
    
    const success = await addPushTokenToUser(userId, pushToken, platform);
    
    if (success) {
      console.log('\n🧪 테스트 푸시 알림을 발송해보시겠습니까? (y/N)');
      // 자동으로 테스트 진행
      await testPushNotification(pushToken);
    }
  } else if (command === 'test') {
    const pushToken = args[1];
    
    if (!pushToken) {
      console.error('❌ 푸시 토큰을 입력해주세요.');
      console.log('사용법: node add-push-token-script.js test [PUSH_TOKEN]');
      return;
    }
    
    await testPushNotification(pushToken);
  } else {
    console.error('❌ 알 수 없는 명령어:', command);
    console.log('사용 가능한 명령어: list, add, test');
  }
  
  // Firebase 연결 종료
  admin.app().delete();
}

// 스크립트 실행
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { addPushTokenToUser, testPushNotification, listAllUsers };
