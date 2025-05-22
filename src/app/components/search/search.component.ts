import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search',
  imports: [FormsModule, CommonModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss'
})
export class SearchComponent {
  categories = ['All Categories', 'Electronics', 'Fashion', 'Books', 'Toys'];
  selectedCategory = 'All Categories';
  searchText = '';

  selectCategory(category: string) {
    this.selectedCategory = category;
  }

  onSearch() {
    console.log('Search:', this.searchText, 'Category:', this.selectedCategory);
    // Call your ProductService or navigate to search results here
  }
}
