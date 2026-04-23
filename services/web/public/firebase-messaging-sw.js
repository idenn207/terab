// importScripts('https://gstatic.com');

// firebase.initializeApp({
//   apiKey: '...',
//   authDomain: '...',
//   projectId: '...',
//   storageBucket: '...',
//   messagingSenderId: '...',
//   appId: '...',
// });

// const messaging = firebase.messaging();

// messaging.onBackgroundMessage((payload) => {
//   console.log('Background message received: ', payload);

//   const notificationTitle = payload.notification.title;
//   const notificationOptions = {
//     body: payload.notification.body,
//     icon: '/logo.png',
//     // 백그라운드에서 직접 링크를 처리하려면 data 필드 활용
//     data: { url: payload.fcmOptions?.link || '/' },
//   };

//   self.registration.showNotification(notificationTitle, notificationOptions);
// });

// // 알림 클릭 이벤트 처리
// self.addEventListener('notificationclick', (event) => {
//   event.notification.close(); // 알림 닫기

//   // payload에 정의된 링크 가져오기
//   const urlToOpen = event.notification.data.url;

//   // 브라우저 탭 열기 또는 포커스
//   event.waitUntil(
//     clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
//       for (let client of windowClients) {
//         if (client.url === urlToOpen && 'focus' in client) return client.focus();
//       }
//       if (clients.openWindow) return clients.openWindow(urlToOpen);
//     }),
//   );
// });
