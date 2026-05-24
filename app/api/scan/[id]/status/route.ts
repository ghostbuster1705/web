import { NextResponse } from "next/server";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_: Request, { params }: RouteContext) {
  return NextResponse.json({
    id: params.id,
    status: "done",
    result_count: null,
    message: "Public mode: status polling is not required.",
  });
}
