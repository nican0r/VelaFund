import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('should render with default variant and size', () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-primary');
    expect(button).toHaveClass('h-10');
  });

  it('should render with destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>);

    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toHaveClass('bg-destructive');
  });

  it('should render with outline variant', () => {
    render(<Button variant="outline">Outline</Button>);

    const button = screen.getByRole('button', { name: 'Outline' });
    expect(button).toHaveClass('border');
    expect(button).toHaveClass('border-input');
  });

  it('should render with ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);

    const button = screen.getByRole('button', { name: 'Ghost' });
    expect(button).not.toHaveClass('bg-primary');
  });

  it('should render with sm size', () => {
    render(<Button size="sm">Small</Button>);

    const button = screen.getByRole('button', { name: 'Small' });
    expect(button).toHaveClass('h-8');
  });

  it('should render with lg size', () => {
    render(<Button size="lg">Large</Button>);

    const button = screen.getByRole('button', { name: 'Large' });
    expect(button).toHaveClass('h-12');
  });

  it('should handle click events', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click</Button>);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>);

    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:pointer-events-none');
  });

  it('should merge custom className', () => {
    render(<Button className="custom-class">Custom</Button>);

    const button = screen.getByRole('button', { name: 'Custom' });
    expect(button).toHaveClass('custom-class');
  });

  it('should render as child element when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Link Button' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
  });
});
