-- AlterTable: add BLING to BiAnalyseProvider enum
ALTER TABLE `core_thinkanalise_connectors`
  MODIFY `provider` ENUM('ASAAS', 'CONTA_AZUL', 'OMIE', 'SONAX', 'BLING') NOT NULL;
