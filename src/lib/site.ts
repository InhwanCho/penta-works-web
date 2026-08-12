/**
 * DB의 zero-padded siteid("001")를 화면 표기용 슬러그("1")로 변환합니다.
 * 대시보드·기준값 화면·상세 링크가 같은 번호를 쓰도록 한곳에서 관리합니다.
 */
export function toSiteSlug(siteid: string): string {
  if (/^\d+$/.test(siteid)) return String(Number(siteid));
  return siteid;
}
