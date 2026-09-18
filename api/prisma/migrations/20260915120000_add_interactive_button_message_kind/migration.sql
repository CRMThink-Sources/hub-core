-- AlterTable
ALTER TABLE `core_thinkerszap_messages` MODIFY `type` ENUM('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER', 'CONTACT', 'INTERACTIVE_BUTTON') NOT NULL;

-- AlterTable
ALTER TABLE `core_thinkerszap_widget_outbox` ADD COLUMN `button_payload` JSON NULL,
    MODIFY `kind` ENUM('TEXT', 'TEMPLATE', 'INTERACTIVE_BUTTON') NOT NULL DEFAULT 'TEXT';

