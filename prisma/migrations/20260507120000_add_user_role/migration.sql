ALTER TABLE `user` ADD COLUMN `role` VARCHAR(191) NOT NULL DEFAULT 'user';

CREATE INDEX `user_role_idx` ON `user`(`role`);
