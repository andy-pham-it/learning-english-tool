import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PaginationComponent } from './pagination.component';

describe('PaginationComponent', () => {
  let fixture: ComponentFixture<PaginationComponent>;
  let component: PaginationComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PaginationComponent] }).compileComponents();
    fixture = TestBed.createComponent(PaginationComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('totalItems', 50);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.detectChanges();
  });

  it('creates', () => expect(component).toBeTruthy());

  it('computes totalPages = ceil(total/pageSize)', () => {
    expect(component.totalPages()).toBe(5);
    fixture.componentRef.setInput('totalItems', 51);
    fixture.detectChanges();
    expect(component.totalPages()).toBe(6);
  });

  it('emits pageChange with {page,pageSize} on next()', () => {
    const spy = jasmine.createSpy('pageChange');
    component.pageChange.subscribe(spy);
    component.next();
    expect(spy).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
  });

  it('clamps at first/last page', () => {
    component.goToPage(0);
    expect(component.page()).toBe(1);
    component.goToPage(99);
    expect(component.page()).toBe(5);
  });

  it('resets to page 1 and emits when size changes', () => {
    component.goToPage(3);
    const spy = jasmine.createSpy('pageChange');
    component.pageChange.subscribe(spy);
    component.onSizeChange(50);
    expect(component.page()).toBe(1);
    expect(spy).toHaveBeenCalledWith({ page: 1, pageSize: 50 });
  });

  it('renders a prev button disabled on page 1', () => {
    const prev = fixture.debugElement.query(By.css('[data-test="prev"]'));
    expect(prev.nativeElement.disabled).toBeTrue();
  });
});
