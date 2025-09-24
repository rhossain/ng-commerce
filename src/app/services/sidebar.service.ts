import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface SidebarState {
  isOpen: boolean;
  componentId?: string;
  config?: {
    title?: string;
    position?: 'left' | 'right';
    width?: string;
    closeOnClickOutside?: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private sidebarState = new BehaviorSubject<SidebarState>({ 
    isOpen: false,
    componentId: undefined
  });
  sidebarState$ = this.sidebarState.asObservable();

  private registeredSidebars: {[id: string]: any} = {};

  register(id: string, component: any) {
    this.registeredSidebars[id] = component;
  }

  unregister(id: string) {
    delete this.registeredSidebars[id];
  }

  open(id?: string, config?: SidebarState['config']) {
    this.sidebarState.next({
      isOpen: true,
      componentId: id,
      config
    });
  }

  close(id?: string) {
    if (id) {
      if (this.registeredSidebars[id]) {
        this.registeredSidebars[id].isOpen = false;
      }
      this.sidebarState.next({
        isOpen: false,
        componentId: id // Keep track of which sidebar was closed
      });
    } else {
      this.sidebarState.next({ 
        isOpen: false,
        componentId: undefined
      });
    }
  }

  toggle(id?: string, config?: SidebarState['config']) {
    const current = this.sidebarState.value;
    if (id && current.componentId === id && current.isOpen) {
      this.close(id);
    } else {
      this.open(id, config);
    }
  }
}