/**
 * Cliente de billing: o portal Bitrix24, uma linha de `core_domains`.
 *
 * `name` é o host do portal (`empresa.bitrix24.com.br`), o mesmo valor da coluna
 * única `name` — não há campo `domain` separado porque seria a mesma coluna duas
 * vezes. `appCode` também não vive aqui: domínio + app code identificam uma
 * **instalação** (`Aplication`), e o mesmo portal instala vários apps.
 */
export interface Customer {
  id: string
  name: string
  memberId: string
}
