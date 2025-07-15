
import React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";

type TasksPaginationProps = {
  page: number;
  setPage: (n: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  totalTasks: number;
  pageSizeOptions: number[];
};

export default function TasksPagination({
  page,
  setPage,
  pageSize,
  setPageSize,
  totalTasks,
  pageSizeOptions,
}: TasksPaginationProps) {
  // Always show pagination info, only hide page numbers if not needed
  const showPageNumbers = totalTasks > pageSize;

  // Calculate display range
  const start = totalTasks === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalTasks);

  return (
    <div className="my-6">
      {/* Show pagination navigation only if needed */}
      {showPageNumbers && (
        <Pagination className="mb-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage(page > 1 ? page - 1 : 1)}
                aria-disabled={page <= 1}
              />
            </PaginationItem>
            {Array.from(
              { length: Math.ceil(totalTasks / pageSize) },
              (_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    isActive={i + 1 === page}
                    onClick={() => setPage(i + 1)}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() =>
                  setPage(
                    page < Math.ceil(totalTasks / pageSize) ? page + 1 : page
                  )
                }
                aria-disabled={page >= Math.ceil(totalTasks / pageSize)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
      
      {/* Always show row info and page size selector */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
          Showing {start}–{end} of {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Rows per page:</span>
          <select
            className="border rounded px-2 py-1 text-sm bg-white"
            value={pageSize}
            onChange={(e) => {
              setPage(1);
              setPageSize(Number(e.target.value));
            }}
          >
            {pageSizeOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
