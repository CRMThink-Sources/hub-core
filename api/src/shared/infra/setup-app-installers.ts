import { AppInstallerRegistry } from './app-installer-registry'
import { ThinkzapInstaller } from '@/modules/thinkzap/install/thinkzap.installer'
import { ClicksignInstaller } from '@/modules/clicksign/install/clicksign.installer'
import { ThinkanaliseInstaller } from '@/modules/thinkanalise/install/thinkanalise.installer'
import { ImportsheetInstaller } from '@/modules/importsheet/install/importsheet.installer'
import { GptMakerInstaller } from '@/modules/gptmaker/install/gptmaker.installer'

const registry = new AppInstallerRegistry()

// Ponto único: app novo entra aqui e em mais lugar nenhum do fluxo de instalação.
registry.register(new ThinkzapInstaller())
registry.register(new ClicksignInstaller())
registry.register(new ThinkanaliseInstaller())
registry.register(new ImportsheetInstaller())
registry.register(new GptMakerInstaller())

export const appInstallerRegistry = registry
