using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PDV.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CobrancasPix : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CobrancasPix",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TxId = table.Column<string>(type: "TEXT", maxLength: 60, nullable: false),
                    Valor = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                    Provedor = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    ExpiraEm = table.Column<DateTime>(type: "TEXT", nullable: false),
                    OperadorMatricula = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    CaixaId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TerminalId = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    MetodoConfirmacao = table.Column<int>(type: "INTEGER", nullable: true),
                    ConfirmadoEm = table.Column<DateTime>(type: "TEXT", nullable: true),
                    SupervisorId = table.Column<Guid>(type: "TEXT", nullable: true),
                    SupervisorMatricula = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    ObservacaoConfirmacao = table.Column<string>(type: "TEXT", maxLength: 300, nullable: true),
                    VendaId = table.Column<Guid>(type: "TEXT", nullable: true),
                    UtilizadoEm = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CriadoEm = table.Column<DateTime>(type: "TEXT", nullable: false),
                    AtualizadoEm = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CobrancasPix", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CobrancasPix_Status",
                table: "CobrancasPix",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_CobrancasPix_TxId",
                table: "CobrancasPix",
                column: "TxId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CobrancasPix_VendaId",
                table: "CobrancasPix",
                column: "VendaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CobrancasPix");
        }
    }
}
