#!/usr/bin/env node
/**
 * 푸시 알림 발송 문제 디버깅 스크립트
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

async function debugPushNotificationToUser(userId) {
  try {
    console.log('🔍 푸시 알림 발송 디버깅 시작');
    console.log('=' .repeat(50));
    
    // 1. 사용자 존재 확인
    console.log('1️⃣ 사용자 문서 조회 중...');
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.error('❌ 사용자를 찾을 수 없습니다:', userId);
      return false;
    }
    
    const userData = userDoc.data();
    console.log('✅ 사용자 발견:', userData?.profile?.userName || '이름 없음');
    
    // 2. 푸시 토큰 확인
    console.log('\n2️⃣ 푸시 토큰 상태 확인 중...');
    const pushTokens = userData.pushTokens;
    
    if (!pushTokens) {
      console.error('❌ pushTokens 필드가 없습니다');
      return false;
    }
    
    console.log('✅ pushTokens 필드 존재');
    console.log('📊 토큰 개수:', Object.keys(pushTokens).length);
    
    // 3. 각 플랫폼별 토큰 상세 확인
    console.log('\n3️⃣ 플랫폼별 토큰 상세 분석:');
    for (const [platform, tokenData] of Object.entries(pushTokens)) {
      console.log(`\n📱 플랫폼: ${platform}`);
      console.log(`   토큰 존재: ${tokenData?.token ? '✅' : '❌'}`);
      
      if (tokenData?.token) {
        console.log(`   토큰: ${tokenData.token.substring(0, 30)}...`);
        console.log(`   플랫폼: ${tokenData.platform || '미지정'}`);
        console.log(`   추가일: ${tokenData.addedAt || '미지정'}`);
        
        // 4. 개별 토큰 테스트
        console.log(`\n🧪 ${platform} 토큰 테스트 중...`);
        await testSingleToken(tokenData.token, platform);
      } else {
        console.log('   ❌ 토큰이 없거나 유효하지 않습니다');
      }
    }
    
    // 5. 웹 함수와 동일한 로직으로 테스트
    console.log('\n4️⃣ 웹과 동일한 로직으로 테스트:');
    await testWebLogic(userId, pushTokens);
    
    return true;
  } catch (error) {
    console.error('❌ 디버깅 중 오류 발생:', error);
    return false;
  }
}

async function testSingleToken(token, platform) {
  try {
    const message = {
      to: token,
      sound: 'default',
      title: `🔍 ${platform.toUpperCase()} 디버그 테스트`,
      body: `${platform} 플랫폼 푸시 토큰 개별 테스트입니다.`,
      data: {
        testType: 'debug-single-token',
        platform: platform,
        timestamp: Date.now()
      },
      priority: 'high',
      channelId: 'default',
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

    console.log(`   📤 발송 중... (${token.substring(0, 20)}...)`);
    
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
      if (result.data?.status === 'ok') {
        console.log('   ✅ 발송 성공!');
        console.log(`   📊 발송 ID: ${result.data.id}`);
      } else {
        console.log('   ⚠️ 발송 응답이 이상합니다:');
        console.log('   📄 응답:', JSON.stringify(result, null, 2));
      }
    } else {
      console.log('   ❌ 발송 실패!');
      console.log('   📄 오류 응답:', JSON.stringify(result, null, 2));
      
      if (result.errors) {
        result.errors.forEach((error, index) => {
          console.log(`   📝 오류 ${index + 1}: ${error.message}`);
          console.log(`   📋 상세: ${JSON.stringify(error.details || {})}`);
        });
      }
    }
  } catch (error) {
    console.log('   🚨 네트워크 오류:', error.message);
  }
}

async function testWebLogic(userId, pushTokens) {
  try {
    console.log('📱 웹과 동일한 발송 로직 시뮬레이션...');
    
    const sendPromises = [];
    let tokenCount = 0;
    
    Object.entries(pushTokens).forEach(([platform, tokenData]) => {
      if (tokenData?.token) {
        tokenCount++;
        console.log(`   ➕ ${platform} 토큰 추가됨`);
        
        const message = {
          to: tokenData.token,
          title: '🌐 웹 로직 테스트',
          body: '웹과 동일한 로직으로 발송하는 테스트입니다.',
          data: {
            type: 'system',
            userId: userId,
            testType: 'web-logic-simulation'
          },
          sound: 'default',
          priority: 'high',
          channelId: 'default',
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
        
        const promise = sendPushNotification(message, platform);
        sendPromises.push(promise);
      }
    });
    
    console.log(`   📊 총 ${tokenCount}개 토큰으로 발송 예정`);
    
    if (sendPromises.length === 0) {
      console.log('   ❌ 발송할 유효한 토큰이 없습니다');
      return;
    }
    
    console.log('   🚀 병렬 발송 시작...');
    const results = await Promise.allSettled(sendPromises);
    
    let successCount = 0;
    let failCount = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successCount++;
          console.log(`   ✅ 토큰 ${index + 1}: 성공`);
        } else {
          failCount++;
          console.log(`   ❌ 토큰 ${index + 1}: 실패 - ${result.value.error}`);
        }
      } else {
        failCount++;
        console.log(`   🚨 토큰 ${index + 1}: 예외 - ${result.reason}`);
      }
    });
    
    console.log(`\n📊 최종 결과: 성공 ${successCount}개, 실패 ${failCount}개`);
    
    const hasSuccess = results.some(result => 
      result.status === 'fulfilled' && result.value.success
    );
    
    if (hasSuccess) {
      console.log('✅ 웹 로직에서는 성공으로 판정됩니다');
    } else {
      console.log('❌ 웹 로직에서는 실패로 판정됩니다');
      
      const errors = results
        .filter(result => result.status === 'rejected' || !result.value?.success)
        .map(result => 
          result.status === 'rejected' 
            ? result.reason 
            : result.value?.error || 'Unknown error'
        );
      
      console.log('📝 오류 목록:');
      errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
  } catch (error) {
    console.log('❌ 웹 로직 시뮬레이션 실패:', error);
  }
}

async function sendPushNotification(message, platform) {
  try {
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
      return { success: true, platform, receipt: result };
    } else {
      return { 
        success: false, 
        platform, 
        error: result.errors?.[0]?.message || `HTTP ${response.status}` 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      platform, 
      error: error.message || 'Network error' 
    };
  }
}

// 메인 실행 함수
async function main() {
  const userId = process.argv[2];
  
  if (!userId) {
    console.log('🔍 푸시 알림 디버깅 도구');
    console.log('=' .repeat(30));
    console.log('');
    console.log('사용법:');
    console.log('  node debug-push-notification.js [USER_ID]');
    console.log('');
    console.log('예시:');
    console.log('  node debug-push-notification.js kgffWa3onhhCBh2sLxiUWw19JWR2');
    return;
  }
  
  await debugPushNotificationToUser(userId);
  
  // Firebase 연결 종료
  admin.app().delete();
}

// 스크립트 실행
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { debugPushNotificationToUser, testSingleToken, testWebLogic };
