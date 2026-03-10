const { Expo } = require("expo-server-sdk");
const admin = require("../config/firebase");
const expo = new Expo();

exports.sendEventNotification = async (pushTokens, event) => {
  const expoTokens = [];
  const fcmTokens = [];

  for (const token of pushTokens) {
    if (Expo.isExpoPushToken(token)) {
      expoTokens.push(token);
    } else {
      fcmTokens.push(token);
    }
  }

  // --- Send Expo Notifications ---
  if (expoTokens.length > 0) {
    console.log(
      "[Notification Debug] Sending Expo notifications to:",
      expoTokens,
    );

    const messages = expoTokens.map((token) => ({
      to: token,
      sound: "default",
      title: event.title,
      body: "Registrations are now open! Tap to register. 📅",
      data: {
        type: "event",
        id: event._id.toString(),
        screen: "EventDetails",
      },
      _displayInForeground: true, // For Expo Go
    }));

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log("[Expo Debug] Tickets received:", ticketChunk);

        // Check for specific errors
        ticketChunk.forEach((ticket, index) => {
          if (ticket.status === "error") {
            console.error(
              `[Expo Error] Error sending to ${chunk[index].to}: ${ticket.message} (${ticket.details?.error})`,
            );
          }
        });
      } catch (error) {
        console.error("Expo push error:", error);
      }
    }
  }

  // --- Send FCM Notifications (Firebase) ---
  if (fcmTokens.length > 0) {
    // Note: sendMulticast supports up to 500 tokens per batch
    const message = {
      notification: {
        title: event.title,
        body: "Registrations are now open! Tap to register. 📅",
      },
      data: {
        type: "event",
        id: event._id.toString(),
        screen: "EventDetails",
      },
      tokens: fcmTokens,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(
        `FCM: ${response.successCount} sent, ${response.failureCount} failed.`,
      );

      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error("FCM error for token:", fcmTokens[idx], resp.error);
          }
        });
      }
    } catch (error) {
      console.error("FCM push global error:", error);
    }
  }
};

exports.sendAchieverNotification = async (pushTokens, achiever) => {
  const expoTokens = [];
  const fcmTokens = [];

  for (const token of pushTokens) {
    if (Expo.isExpoPushToken(token)) {
      expoTokens.push(token);
    } else {
      fcmTokens.push(token);
    }
  }

  // Simple & Professional Message
  const notificationTitle = `New Achievement: ${achiever.name}`;
  const notificationBody = `Let's congratulate them on this great success! 🏆`;

  // --- Send Expo Notifications ---
  if (expoTokens.length > 0) {
    const messages = expoTokens.map((token) => ({
      to: token,
      sound: "default",
      title: notificationTitle,
      body: notificationBody,
      data: {
        type: "achiever",
        id: achiever._id.toString(),
        screen: "AchieverDetails",
      },
    }));

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error("Expo push error (Achiever):", error);
      }
    }
  }

  // --- Send FCM Notifications (Firebase) ---
  if (fcmTokens.length > 0) {
    const message = {
      notification: {
        title: notificationTitle,
        body: notificationBody,
      },
      data: {
        type: "achiever",
        id: achiever._id.toString(),
        screen: "AchieverDetails",
      },
      tokens: fcmTokens,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(
        `FCM (Achiever): ${response.successCount} sent, ${response.failureCount} failed.`,
      );

      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error("FCM error for token:", fcmTokens[idx], resp.error);
          }
        });
      }
    } catch (error) {
      console.error("FCM push global error (Achiever):", error);
    }
  }
};

exports.sendSubmissionStatusNotification = async (
  pushTokens,
  submission,
  status,
) => {
  const expoTokens = [];
  const fcmTokens = [];

  if (!pushTokens || pushTokens.length === 0) return;

  for (const token of pushTokens) {
    if (Expo.isExpoPushToken(token)) {
      expoTokens.push(token);
    } else {
      fcmTokens.push(token);
    }
  }

  const isApproved = status === "approved";
  const title = isApproved
    ? "Achievement Approved! 🎉"
    : "Update on your Achievement";
  const body = isApproved
    ? `Your submission "${submission.title}" has been approved and points have been awarded.`
    : `Your submission "${submission.title}" has been updated to ${status}.`;

  // --- Send Expo Notifications ---
  if (expoTokens.length > 0) {
    const messages = expoTokens.map((token) => ({
      to: token,
      sound: "default",
      title: title,
      body: body,
      data: {
        type: "submission_status",
        id: submission._id.toString(),
        status: status,
      },
    }));

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error("Expo push error (Submission):", error);
      }
    }
  }

  // --- Send FCM Notifications (Firebase) ---
  if (fcmTokens.length > 0) {
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        type: "submission_status",
        id: submission._id.toString(),
        status: status,
      },
      tokens: fcmTokens,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      if (response.failureCount > 0) {
        console.error("FCM error (Submission):", response.responses);
      }
    } catch (error) {
      console.error("FCM push global error (Submission):", error);
    }
  }
};
