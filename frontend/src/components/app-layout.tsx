import { Container } from "@mui/material";
import { Outlet } from "react-router-dom";
import { Header } from "./header";

export function AppLayout() {
    return (
        <>
            <Header />
            <Container maxWidth="lg" className="py-6">
                <Outlet />
            </Container>
        </>
    );
}
