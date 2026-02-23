import { render, screen, fireEvent } from "@testing-library/react";
import ErrorState from "@/components/ErrorState";

describe("ErrorState", () => {
  it("renders error message", () => {
    render(<ErrorState message="Something broke" onRetry={() => {}} />);
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load articles")).toBeInTheDocument();
  });

  it("renders fallback message when none provided", () => {
    render(<ErrorState message="" onRetry={() => {}} />);
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
  });

  it("calls onRetry when button clicked", () => {
    const onRetry = jest.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Try Again"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
