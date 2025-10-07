/**
 * 모든 알림 타입의 푸시 발송 테스트 스크립트
 * 사용법: node test-all-notification-types.js [USER_ID]
 */

const admin = require('firebase-admin');
const path = require('path');

// Firebase Admin 초기화
const serviceAccount = require('../../shared/credentials/inschoolz-firebase-adminsdk-p6trg-c275cfa0f4.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://inschoolz-default-rtdb.asia-southeast1.firebasedatabase.app'
  });
}

const db = admin.firestore();

// 모든 알림 타입 정의 (개선된 템플릿 사용)
const NOTIFICATION_TYPES = [
  { type: 'post_comment', title: '💬 새 댓글', message: '홍길동님이 회원님의 게시글에 댓글을 남겼습니다.' },
  { type: 'comment_reply', title: '↩️ 새 답글', message: '김철수님이 회원님의 댓글에 답글을 남겼습니다.' },
  { type: 'system', title: '📢 시스템 알림', message: '중요한 시스템 공지사항이 있습니다.' },
  { type: 'general', title: '📱 일반 알림', message: '새로운 소식이 있습니다.' },
  { type: 'event', title: '🎉 이벤트 알림', message: '새로운 이벤트가 시작되었습니다.' },
  { type: 'referral', title: '🎯 추천인 등록', message: '이영희님이 회원님을 추천인으로 설정했습니다.' },
  { type: 'warning', title: '🚨 경고 알림', message: '커뮤니티 규칙 위반으로 경고가 발송되었습니다.' },
  { type: 'suspension', title: '🔒 계정 정지', message: '계정이 일시 정지되었습니다.' },
  { type: 'report_received', title: '⚠️ 신고 접수', message: '회원님의 콘텐츠가 신고되었습니다.' },
  { type: 'report_resolved', title: '✅ 신고 처리 완료', message: '신고 처리가 완료되었습니다.' },
  // 미구현 알림 타입들 (테스트용)
  { type: 'like', title: '❤️ 좋아요', message: '박민수님이 회원님의 게시글에 좋아요를 눌렀습니다.' },
  { type: 'follow', title: '👥 새 팔로워', message: '정수진님이 회원님을 팔로우하기 시작했습니다.' }
];

/**
 * Expo Push API를 사용하여 푸시 알림 발송
 */
async function sendExpoPushNotification(message) {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (response.ok) {
      return { success: true, receipt: result };
    } else {
      return { success: false, error: result.errors?.[0]?.message || 'Unknown error' };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.message || 'Network error' 
    };
  }
}

/**
 * 사용자의 푸시 토큰으로 모든 알림 타입 테스트
 */
async function testAllNotificationTypes(userId) {
  console.log(`🧪 사용자 ${userId}의 모든 알림 타입 푸시 발송 테스트 시작...\n`);

  // 사용자 정보 및 푸시 토큰 조회
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    console.error('❌ 사용자를 찾을 수 없습니다:', userId);
    return;
  }

  const userData = userDoc.data();
  const pushTokens = userData.pushTokens;

  if (!pushTokens) {
    console.error('❌ 푸시 토큰이 없습니다. 먼저 앱에서 로그인하거나 수동으로 토큰을 추가해주세요.');
    return;
  }

  console.log(`👤 사용자: ${userData.profile?.userName || '이름 없음'}`);
  console.log(`📱 등록된 푸시 토큰:`, Object.keys(pushTokens));
  console.log('');

  // 각 알림 타입별로 테스트
  const results = [];
  
  for (let i = 0; i < NOTIFICATION_TYPES.length; i++) {
    const notifType = NOTIFICATION_TYPES[i];
    console.log(`📤 [${i + 1}/${NOTIFICATION_TYPES.length}] ${notifType.type} 테스트 중...`);

    // 각 플랫폼의 토큰으로 발송
    const platformResults = [];
    
    for (const [platform, tokenData] of Object.entries(pushTokens)) {
      if (tokenData?.token) {
        const message = {
          to: tokenData.token,
          title: `[테스트] ${notifType.title}`,
          body: notifType.message,
          data: {
            type: notifType.type,
            userId,
            testMode: true,
            timestamp: Date.now()
          },
          sound: 'default',
          priority: 'high',
          channelId: getChannelId(notifType.type),
          // 인스쿨즈 사용자 정의 아이콘
          icon: 'https://inschoolz.com/android-icon-96x96.png',
          android: {
            channelId: getChannelId(notifType.type),
            sound: true,
            priority: 'high',
            vibrate: true,
            color: '#FF231F7C',
            icon: 'https://inschoolz.com/android-icon-96x96.png',
            largeIcon: 'https://inschoolz.com/android-icon-192x192.png',
          },
          ios: {
            sound: true,
            _displayInForeground: true,
            attachments: [{
              url: 'https://inschoolz.com/apple-icon-180x180.png',
              type: 'image'
            }],
          },
        };

        const result = await sendExpoPushNotification(message);
        platformResults.push({
          platform,
          success: result.success,
          error: result.error,
          receipt: result.receipt?.data?.id
        });

        if (result.success) {
          console.log(`   ✅ ${platform}: 성공 (${result.receipt?.data?.id})`);
        } else {
          console.log(`   ❌ ${platform}: 실패 - ${result.error}`);
        }
      }
    }

    results.push({
      type: notifType.type,
      title: notifType.title,
      platforms: platformResults,
      success: platformResults.some(r => r.success)
    });

    // 다음 테스트까지 1초 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 결과 요약
  console.log('\n📊 테스트 결과 요약:');
  console.log('='.repeat(50));
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`총 ${totalCount}개 알림 타입 중 ${successCount}개 성공 (${Math.round(successCount/totalCount*100)}%)`);
  console.log('');

  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.type}: ${result.title}`);
    
    result.platforms.forEach(platform => {
      const platformStatus = platform.success ? '✅' : '❌';
      console.log(`   ${platformStatus} ${platform.platform}${platform.receipt ? ` (${platform.receipt})` : ''}`);
    });
  });

  if (successCount === totalCount) {
    console.log('\n🎉 모든 알림 타입의 푸시 발송이 정상적으로 작동합니다!');
  } else {
    console.log(`\n⚠️  ${totalCount - successCount}개 알림 타입에서 문제가 발생했습니다.`);
  }
}

/**
 * 알림 타입에 따른 채널 ID 반환
 */
function getChannelId(type) {
  const channelMap = {
    post_comment: 'comments',
    comment_reply: 'comments',
    system: 'system',
    general: 'general',
    event: 'events',
    referral: 'social',
    warning: 'warnings',
    suspension: 'warnings',
    report_received: 'reports',
    report_resolved: 'reports',
    like: 'social',
    comment: 'comments',
    reply: 'comments',
    follow: 'social',
  };
  
  return channelMap[type] || 'default';
}

/**
 * 메인 실행 함수
 */
async function main() {
  const userId = process.argv[2];
  
  if (!userId) {
    console.log('사용법: node test-all-notification-types.js [USER_ID]');
    console.log('');
    console.log('예시:');
    console.log('  node test-all-notification-types.js kgffWa3onhhCBh2sLxiUWw19JWR2');
    return;
  }

  try {
    await testAllNotificationTypes(userId);
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류 발생:', error);
  }
}

// 스크립트가 직접 실행될 때만 main 함수 호출
if (require.main === module) {
  main();
}
