
import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostBinding } from '@angular/core';
import { SidebarService } from '../../services/sidebar.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  host: {
    '[class.sidebar-initialized]': 'initialized'
  }
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Input() id?: string;
  @Input() title = 'Menu';
  @Input() width = '280px';
  @Input() position: 'left' | 'right' = 'left';
  @Input() closeOnClickOutside = true;
  @Output() isOpenChange = new EventEmitter<boolean>();

  isOpen = false;
  initialized = false;
  currentConfig = {
    title: this.title,
    position: this.position,
    width: this.width,
    closeOnClickOutside: this.closeOnClickOutside
  };

  constructor(private sidebarService: SidebarService) {}

  ngOnInit() {
    if (this.id) {
      this.sidebarService.register(this.id, this);
    }

    // Initialize position immediately
    this.setInitialPosition();

    this.sidebarService.sidebarState$.subscribe(state => {
      if (!this.id || state.componentId === this.id) {
        this.isOpen = state.isOpen;
        if (state.config) {
          this.currentConfig = {
            ...this.currentConfig,
            ...state.config
          };
        }
        this.isOpenChange.emit(this.isOpen);
      }
    });

    // Mark as initialized after a tick
    setTimeout(() => this.initialized = true);
  }

  private setInitialPosition() {
    // Force set initial position before first render
    if (this.id) {
      this.sidebarService.open(this.id, {
        position: this.position,
        width: this.width,
        title: this.title,
        closeOnClickOutside: this.closeOnClickOutside
      });
      this.sidebarService.close(this.id);
    }
  }

  ngOnDestroy() {
    if (this.id) {
      this.sidebarService.unregister(this.id);
    }
  }

  get sidebarClasses() {
    return {
      'open': this.isOpen,
      'left': this.currentConfig.position === 'left',
      'right': this.currentConfig.position === 'right',
      'initial-position-set': this.initialized
    };
  }

  get overlayClasses() {
    return {
      'show': this.isOpen && this.currentConfig.closeOnClickOutside
    };
  }

  toggle() {
    this.sidebarService.toggle(this.id);
  }

  close() {
    this.sidebarService.close(this.id);
  }
}
