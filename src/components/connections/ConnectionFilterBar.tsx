import { Search, X, Filter, Check } from "lucide-react";
import { Input, Button } from "@/components/ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useConnectionsStore } from "@/stores";
import { cn } from "@/lib/utils";

export function ConnectionFilterBar() {
  const {
    groups,
    tags,
    activeGroupFilter,
    activeTagFilters,
    searchQuery,
    setSearchQuery,
    setActiveGroupFilter,
    toggleTagFilter,
    clearFilters,
  } = useConnectionsStore();

  const hasActiveFilters =
    activeGroupFilter !== null || activeTagFilters.length > 0;
  const activeFilterCount =
    (activeGroupFilter ? 1 : 0) + activeTagFilters.length;

  const hasGroupsOrTags = groups.length > 0 || tags.length > 0;

  return (
    <div className="px-2 py-1.5 border-b border-sidebar-border">
      {/* Single row: Search + Filter */}
      <div className="flex items-center gap-1.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="h-7 pl-7 pr-7 text-xs bg-sidebar-accent/50"
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Button with Popover */}
        {hasGroupsOrTags && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={hasActiveFilters ? "secondary" : "ghost"}
                size="icon"
                className={cn(
                  "h-7 w-7 flex-shrink-0 relative",
                  hasActiveFilters && "text-primary"
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary text-[9px] font-medium text-primary-foreground flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-0" align="end">
              <div className="p-2 border-b border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Filters</span>
                  {hasActiveFilters && (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={clearFilters}
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              {/* Groups Section */}
              {groups.length > 0 && (
                <div className="p-1.5">
                  <div className="micro-label px-2 py-1">
                    Groups
                  </div>
                  <div className="space-y-0.5">
                    {groups
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((group) => (
                        <button
                          key={group.id}
                          className={cn(
                            "w-full text-left px-2 py-[var(--pad-menu-y)] text-sm rounded-md transition-colors flex items-center gap-2",
                            activeGroupFilter === group.id
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/50"
                          )}
                          onClick={() =>
                            setActiveGroupFilter(
                              activeGroupFilter === group.id ? null : group.id
                            )
                          }
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: group.color }}
                          />
                          <span className="truncate flex-1">{group.name}</span>
                          {activeGroupFilter === group.id && (
                            <Check className="h-3.5 w-3.5 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Tags Section */}
              {tags.length > 0 && (
                <div className="p-1.5 border-t border-border">
                  <div className="micro-label px-2 py-1">
                    Tags
                  </div>
                  <div className="space-y-0.5">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        className={cn(
                          "w-full text-left px-2 py-[var(--pad-menu-y)] text-sm rounded-md transition-colors flex items-center gap-2",
                          activeTagFilters.includes(tag.id)
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50"
                        )}
                        onClick={() => toggleTagFilter(tag.id)}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="truncate flex-1">{tag.name}</span>
                        {activeTagFilters.includes(tag.id) && (
                          <Check className="h-3.5 w-3.5 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Active Filters as inline chips (only if filters are active) */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {activeGroupFilter && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/80"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: groups.find((g) => g.id === activeGroupFilter)?.color,
                }}
              />
              {groups.find((g) => g.id === activeGroupFilter)?.name}
              <button
                className="hover:text-foreground"
                onClick={() => setActiveGroupFilter(null)}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {activeTagFilters.map((tagId) => {
            const tag = tags.find((t) => t.id === tagId);
            if (!tag) return null;
            return (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/80"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
                <button
                  className="hover:text-foreground"
                  onClick={() => toggleTagFilter(tag.id)}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
