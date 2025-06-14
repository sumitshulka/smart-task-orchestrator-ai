
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
  if (totalTasks <= pageSize) return null;
  return (
    <Pagination className="my-6">
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
                page < Math.ceil(totalTasks / pageSize)
                  ? page + 1
                  : page
              )
            }
            aria-disabled={page >= Math.ceil(totalTasks / pageSize)}
          />
        </PaginationItem>
      </PaginationContent>
      <div className="flex items-center gap-2 ml-8">
        <span className="text-sm">Rows per page:</span>
        <select
          className="border rounded px-2 text-sm"
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
    </Pagination>
  );
}
