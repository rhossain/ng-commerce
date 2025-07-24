import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { SearchService } from '../../services/search.service';
import { CategoryService } from '../../services/category.service';
import { ProductCategory } from '../../models/category.model';

@Component({
  selector: 'app-search',
  imports: [FormsModule, CommonModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss'
})
export class SearchComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput', { static: false }) searchInput!: ElementRef<HTMLInputElement>;

  categories: ProductCategory[] = [];
  selectedCategory = 'All Categories';
  selectedCategoryId: number | null = null;
  searchText = '';
  
  // Real-time suggestions
  searchSuggestions: string[] = [];
  showSuggestions = false;
  selectedSuggestionIndex = -1;
  isLoadingSuggestions = false;
  
  // Search history
  searchHistory: string[] = [];
  showHistory = false;
  
  // Loading state
  isSearching = false;

  // Search input subject for debouncing
  private searchInputSubject = new Subject<string>();

  private destroy$ = new Subject<void>();

  constructor(
    private searchService: SearchService,
    private categoryService: CategoryService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadCategories();
    this.loadSearchHistory();
    this.setupSearchSuggestions();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchSuggestions(): void {
    this.searchInputSubject.pipe(
      debounceTime(300), // Wait 300ms after user stops typing
      distinctUntilChanged(), // Only trigger if the value actually changed
      takeUntil(this.destroy$)
    ).subscribe(query => {
      if (query.trim().length >= 2) {
        this.isLoadingSuggestions = true;
        this.searchService.getSearchSuggestions(query).subscribe({
          next: (suggestions) => {
            this.searchSuggestions = suggestions;
            this.isLoadingSuggestions = false;
            this.showSuggestions = suggestions.length > 0;
            this.showHistory = false;
          },
          error: (error) => {
            console.error('Error getting suggestions:', error);
            this.isLoadingSuggestions = false;
            this.showSuggestions = false;
          }
        });
      } else {
        this.hideSuggestions();
      }
    });
  }

  private loadCategories(): void {
    this.categoryService.getAllCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.categories = [
            { id: 0, name: 'All Categories', created_at: 0, image: '' } as ProductCategory,
            ...categories
          ];
        },
        error: (error) => console.error('Failed to load categories:', error)
      });
  }

  private loadSearchHistory(): void {
    this.searchService.searchHistory$
      .pipe(takeUntil(this.destroy$))
      .subscribe(history => {
        this.searchHistory = history;
      });
  }

  selectCategory(category: ProductCategory): void {
    this.selectedCategory = category.name;
    this.selectedCategoryId = category.id === 0 ? null : category.id;
  }

  onSearchInput(): void {
    // Trigger suggestions through the debounced subject
    this.searchInputSubject.next(this.searchText);
  }

  onSearchFocus(): void {
    if (this.searchText.trim().length === 0 && this.searchHistory.length > 0) {
      this.showHistory = true;
      this.showSuggestions = false;
    } else if (this.searchText.trim().length >= 2) {
      this.showSuggestions = this.searchSuggestions.length > 0;
      this.showHistory = false;
    }
  }

  onSearchBlur(): void {
    // Delay hiding to allow clicks on suggestions/history
    setTimeout(() => {
      this.hideSuggestions();
      this.showHistory = false;
    }, 200);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (this.showSuggestions && this.searchSuggestions.length > 0) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.selectedSuggestionIndex = 
            this.selectedSuggestionIndex < this.searchSuggestions.length - 1 
              ? this.selectedSuggestionIndex + 1 
              : 0;
          break;
          
        case 'ArrowUp':
          event.preventDefault();
          this.selectedSuggestionIndex = 
            this.selectedSuggestionIndex > 0 
              ? this.selectedSuggestionIndex - 1 
              : this.searchSuggestions.length - 1;
          break;
          
        case 'Enter':
          event.preventDefault();
          if (this.selectedSuggestionIndex >= 0) {
            this.selectSuggestion(this.searchSuggestions[this.selectedSuggestionIndex]);
          } else {
            this.onSearch();
          }
          break;
          
        case 'Escape':
          event.preventDefault();
          this.hideSuggestions();
          this.showHistory = false;
          break;
      }
    } else {
      if (event.key === 'Enter') {
        this.onSearch();
      } else if (event.key === 'Escape') {
        this.hideSuggestions();
        this.showHistory = false;
      }
    }
  }

  selectSuggestion(suggestion: string): void {
    this.searchText = suggestion;
    this.hideSuggestions();
    this.showHistory = false;
    this.onSearch();
  }

  selectHistoryItem(query: string): void {
    this.searchText = query;
    this.showHistory = false;
    this.onSearch();
  }

  onSearch(): void {
    const query = this.searchText.trim();
    
    if (!query && !this.selectedCategoryId) {
      return;
    }

    this.isSearching = true;
    this.showHistory = false;

    // Build search parameters
    const searchParams: any = {
      page: 1,
      per_page: 12
    };

    if (query) {
      searchParams.q = query;
    }

    if (this.selectedCategoryId) {
      searchParams.category_id = this.selectedCategoryId;
    }

    // ✅ Navigate to shop instead of search-results
    this.router.navigate(['/shop'], { 
      queryParams: searchParams 
    });

    this.isSearching = false;
  }

  clearSearch(): void {
    this.searchText = '';
    this.selectedCategory = 'All Categories';
    this.selectedCategoryId = null;
    this.hideSuggestions();
    this.showHistory = false;
    
    if (this.searchInput) {
      this.searchInput.nativeElement.focus();
    }
  }

  clearSearchHistory(): void {
    this.searchService.clearSearchHistory();
  }

  private hideSuggestions(): void {
    this.showSuggestions = false;
    this.selectedSuggestionIndex = -1;
    this.isLoadingSuggestions = false;
  }

  // Helper methods for templates
  getSuggestionClass(index: number): string {
    return index === this.selectedSuggestionIndex ? 'suggestion-item active' : 'suggestion-item';
  }

  trackByIndex(index: number, item: any): number {
    return index;
  }

  trackByText(index: number, item: string): string {
    return item;
  }
}