type PaginationProps = {
  currentPage: number // 0-indexed
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  maxButtons?: number // 표시할 최대 페이지 버튼 수 (default: 5)
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  maxButtons = 5,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize)

  // 1페이지만 있으면 페이지네이션 숨김
  if (totalPages <= 1) return null

  const showPrev = currentPage > 0
  const showNext = currentPage < totalPages - 1

  // 페이지 번호 계산 (중앙 정렬)
  const getPageNumbers = () => {
    const pages: number[] = []
    let start = Math.max(0, currentPage - Math.floor(maxButtons / 2))
    let end = Math.min(totalPages - 1, start + maxButtons - 1)

    // 오른쪽 끝에 도달하면 왼쪽으로 조정
    if (end - start + 1 < maxButtons) {
      start = Math.max(0, end - maxButtons + 1)
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      {/* 이전 버튼 */}
      {showPrev && (
        <button
          onClick={() => onPageChange(currentPage - 1)}
          className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors"
        >
          이전
        </button>
      )}

      {/* 페이지 번호 */}
      {pageNumbers.map((pageNum) => {
        const isCurrent = pageNum === currentPage
        return (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum)}
            className={`min-w-[36px] h-9 px-2 text-sm rounded-lg transition-colors ${
              isCurrent
                ? 'bg-[#1a2b5a] text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {pageNum + 1}
          </button>
        )
      })}

      {/* 다음 버튼 */}
      {showNext && (
        <button
          onClick={() => onPageChange(currentPage + 1)}
          className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors"
        >
          다음
        </button>
      )}
    </div>
  )
}
