ALTER TABLE `core_importsheets_imports`
  ADD COLUMN `start_row` INT NOT NULL DEFAULT 2 AFTER `config`;
