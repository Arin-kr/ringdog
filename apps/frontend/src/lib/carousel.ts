export interface ScrollBox {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

// 브라우저 확대/축소 때 scrollLeft가 소수점으로 끝나도 "끝에 도착"으로 본다.
const EDGE_TOLERANCE_PX = 1;

/** 가로 목록의 [<] [>] 버튼 활성 여부. 내용이 다 보이면 둘 다 false(버튼 숨김). */
export function carouselEdges({ scrollLeft, clientWidth, scrollWidth }: ScrollBox): {
  canPrev: boolean;
  canNext: boolean;
} {
  return {
    canPrev: scrollLeft > EDGE_TOLERANCE_PX,
    canNext: scrollLeft + clientWidth < scrollWidth - EDGE_TOLERANCE_PX,
  };
}

/** 버튼 한 번에 움직일 거리: 보이는 폭의 80% → 직전 화면의 카드 일부가 남아 위치를 놓치지 않는다. */
export function carouselStep(clientWidth: number): number {
  return Math.round(clientWidth * 0.8);
}
