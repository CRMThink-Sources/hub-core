-- AlterTable
ALTER TABLE `core_thinkerszap_messages` MODIFY `type` ENUM('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER', 'CONTACT') NOT NULL;
