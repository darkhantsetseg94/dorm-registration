const { createSettingsService } = require('./settingsService');
const { createNotificationService } = require('./notificationService');
const { createDormService } = require('./dormService');
const { createApplicationService } = require('./applicationService');
const { createUserService } = require('./userService');
const { createAnnouncementService } = require('./announcementService');
const { createStatsService } = require('./statsService');

/** Бүх service-ийг нэг өгөгдлийн сантай холбож үүсгэнэ. */
function createServices(db) {
  const settingsService = createSettingsService(db);
  const notificationService = createNotificationService(db);
  const dormService = createDormService(db);
  const applicationService = createApplicationService(db, { dormService, settingsService, notificationService });
  const userService = createUserService(db, { settingsService });
  const announcementService = createAnnouncementService(db);
  const statsService = createStatsService(db, { dormService });

  return {
    settings: settingsService,
    notifications: notificationService,
    dorms: dormService,
    applications: applicationService,
    users: userService,
    announcements: announcementService,
    stats: statsService,
  };
}

module.exports = { createServices };
